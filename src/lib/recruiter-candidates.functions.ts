import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db.server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const ANALYSIS_SCHEMA = `Return EXACTLY a JSON object with this shape:
{
  "overall_score": number (0-100),
  "ats_score": number (0-100),
  "clarity": number (0-100),
  "impact": number (0-100),
  "technical": number (0-100),
  "communication": number (0-100),
  "project_quality": number (0-100),
  "leadership": number (0-100),
  "problem_solving": number (0-100),
  "recruiter_appeal": number (0-100),
  "growth_potential": number (0-100),
  "confidence_prediction": number (0-100),
  "hiring_recommendation": "strong_hire" | "hire" | "maybe" | "no_hire",
  "career_level": "intern" | "junior" | "mid" | "senior" | "staff" | "principal",
  "years_experience": number,
  "summary": "2-3 sentence personalized recruiter-facing summary of THIS candidate",
  "strengths": [4-6 specific strings citing the resume],
  "gaps": [3-5 specific strings citing the resume],
  "ranking_explanation": "One paragraph explaining WHY this candidate scored this overall_score",
  "structured": {
    "name": "Full name extracted from resume",
    "email": "email or null",
    "phone": "phone or null",
    "location": "city / remote / null",
    "linkedin": "url or null",
    "github": "url or null",
    "portfolio": "url or null",
    "headline": "Candidate's main title/role",
    "summary": "Their own written summary (or synthesized)",
    "skills": {
      "languages": [strings],
      "frameworks": [strings],
      "libraries": [strings],
      "databases": [strings],
      "cloud": [strings],
      "tools": [strings],
      "soft": [strings]
    },
    "experience": [{"company": "string", "role": "string", "period": "string", "location": "string", "bullets": [strings]}],
    "projects": [{"name": "string", "description": "string", "tech": [strings], "impact": "string"}],
    "education": [{"school": "string", "degree": "string", "period": "string"}],
    "certifications": [strings],
    "achievements": [strings],
    "languages_spoken": [strings]
  }
}
Every insight must be specific to this exact resume. No generic filler.`;

const UploadInput = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  contentBase64: z.string().min(10),
});

// Recruiter uploads a resume; we analyze it and store it under the recruiter's user_id.
export const recruiterUploadResume = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ data, context }) => {
    if (context.role !== "recruiter") throw new Error("Recruiter role required");
    const { extractResumeText } = await import("@/lib/resume-parser.server");
    const { geminiOcr } = await import("@/lib/gemini.server");
    const { groqJson } = await import("@/lib/groq.server");
    const { embed } = await import("@/lib/embeddings.server");

    const bin = Uint8Array.from(atob(data.contentBase64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 10 * 1024 * 1024) throw new Error("File exceeds 10MB");

    const resumeId = uuidv4();
    const safe = data.fileName.replace(/[^a-z0-9.\-_]/gi, "_");
    const rel = `${context.userId}-${Date.now()}-${safe}`;
    const full = path.resolve(process.cwd(), ".data", "resumes", rel);
    fs.writeFileSync(full, bin);

    let raw = "";
    if (data.mimeType.startsWith("image/")) {
      raw = await geminiOcr(data.contentBase64, data.mimeType);
    } else {
      raw = await extractResumeText(bin.buffer as ArrayBuffer, data.mimeType, data.fileName);
    }
    if (!raw || raw.trim().length < 30) throw new Error("Could not extract meaningful text from resume");
    raw = raw.slice(0, 30000);

    const analysis = await groqJson<any>({
      system: `You are Hirely.ai, an elite AI recruiter analyzing a resume for a hiring manager.\n${ANALYSIS_SCHEMA}`,
      user: `Resume text:\n\n${raw}`,
    });

    let vec: string | null = null;
    try {
      const structured = analysis.structured ?? {};
      const skillsFlat = Object.values(structured.skills ?? {}).flat().join(", ");
      const v = await embed(
        `${structured.headline ?? ""}\n${analysis.summary ?? ""}\nSkills: ${skillsFlat}\n${raw.slice(0, 4000)}`
      );
      vec = JSON.stringify(v);
    } catch {}

    // Store resume under recruiter's user_id so it belongs to their private pool.
    db.prepare(`
      INSERT INTO resumes (id, user_id, uploader_id, file_name, storage_path, mime_type, raw_text, structured, embedding, label, recruiter_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review')
    `).run(
      resumeId, context.userId, context.userId, data.fileName, rel, data.mimeType, raw,
      JSON.stringify(analysis.structured ?? {}), vec, "Uploaded"
    );

    db.prepare(`
      INSERT INTO resume_analyses (id, resume_id, user_id, overall_score, ats_score, clarity, impact, summary, strengths, gaps, roadmap, raw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), resumeId, context.userId,
      Math.round(analysis.overall_score ?? 0),
      Math.round(analysis.ats_score ?? 0),
      Math.round(analysis.clarity ?? 0),
      Math.round(analysis.impact ?? 0),
      analysis.summary ?? "",
      JSON.stringify(analysis.strengths ?? []),
      JSON.stringify(analysis.gaps ?? []),
      JSON.stringify([]),
      JSON.stringify(analysis)
    );

    return {
      resumeId,
      name: analysis.structured?.name ?? data.fileName,
      score: Math.round(analysis.overall_score ?? 0),
    };
  });

export const listRecruiterCandidates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.role !== "recruiter") throw new Error("Recruiter role required");
    // Show all resumes the recruiter uploaded OR (fallback) all resumes if uploader tracking is missing.
    const rows = db.prepare(`
      SELECT id, file_name, created_at, structured, recruiter_status, recruiter_notes, mime_type
      FROM resumes
      WHERE uploader_id = ? OR uploader_id IS NULL
      ORDER BY created_at DESC
      LIMIT 500
    `).all(context.userId) as any[];

    return rows.map(r => {
      const a = db.prepare(`SELECT overall_score, ats_score, clarity, impact, summary, strengths, gaps, raw FROM resume_analyses WHERE resume_id = ? ORDER BY created_at DESC LIMIT 1`).get(r.id) as any;
      const structured = r.structured ? safe(r.structured) : {};
      const raw = a?.raw ? safe(a.raw) : {};
      return {
        resume_id: r.id,
        file_name: r.file_name,
        created_at: r.created_at,
        status: r.recruiter_status ?? 'needs_review',
        notes: r.recruiter_notes ?? '',
        structured,
        name: structured?.name ?? r.file_name,
        headline: structured?.headline ?? '',
        email: structured?.email ?? null,
        phone: structured?.phone ?? null,
        overall_score: a?.overall_score ?? 0,
        summary: a?.summary ?? '',
        strengths: a?.strengths ? safe(a.strengths) : [],
        gaps: a?.gaps ? safe(a.gaps) : [],
        analysis: raw,
      };
    });
  });

export const getRecruiterCandidate = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.role !== "recruiter") throw new Error("Recruiter role required");
    const r = db.prepare(`SELECT * FROM resumes WHERE id = ?`).get(data.id) as any;
    if (!r) return null;
    const a = db.prepare(`SELECT * FROM resume_analyses WHERE resume_id = ? ORDER BY created_at DESC LIMIT 1`).get(r.id) as any;
    return {
      resume_id: r.id,
      file_name: r.file_name,
      created_at: r.created_at,
      status: r.recruiter_status ?? 'needs_review',
      notes: r.recruiter_notes ?? '',
      raw_text: r.raw_text,
      structured: r.structured ? safe(r.structured) : {},
      analysis: a ? {
        overall_score: a.overall_score,
        ats_score: a.ats_score,
        clarity: a.clarity,
        impact: a.impact,
        summary: a.summary,
        strengths: a.strengths ? safe(a.strengths) : [],
        gaps: a.gaps ? safe(a.gaps) : [],
        raw: a.raw ? safe(a.raw) : {},
      } : null,
    };
  });

export const setCandidateStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({
    resumeId: z.string(),
    status: z.enum(["needs_review", "shortlisted", "rejected"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.role !== "recruiter") throw new Error("Recruiter role required");
    db.prepare(`UPDATE resumes SET recruiter_status = ? WHERE id = ?`).run(data.status, data.resumeId);
    return { ok: true };
  });

export const setCandidateNotes = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({
    resumeId: z.string(),
    notes: z.string().max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.role !== "recruiter") throw new Error("Recruiter role required");
    db.prepare(`UPDATE resumes SET recruiter_notes = ? WHERE id = ?`).run(data.notes, data.resumeId);
    return { ok: true };
  });

export const deleteRecruiterCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ resumeId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    if (context.role !== "recruiter") throw new Error("Recruiter role required");
    db.prepare(`DELETE FROM resume_analyses WHERE resume_id = ?`).run(data.resumeId);
    db.prepare(`DELETE FROM resumes WHERE id = ?`).run(data.resumeId);
    return { ok: true };
  });

function safe(s: any) {
  if (typeof s !== "string") return s;
  try { return JSON.parse(s); } catch { return null; }
}
