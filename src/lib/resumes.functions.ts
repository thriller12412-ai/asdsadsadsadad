import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db.server";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const UploadInput = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  contentBase64: z.string().min(10),
});

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
  "formatting": number (0-100),
  "grammar": number (0-100),
  "recruiter_appeal": number (0-100),
  "interview_readiness": number (0-100),
  "summary": "2-3 sentence personalized summary of THIS candidate",
  "strengths": [3-6 specific strings citing the resume],
  "gaps": [3-6 specific strings citing the resume],
  "roadmap": [{"area": "string", "suggestion": "concrete personalized action"}],
  "strongest_skills": [strings],
  "weakest_areas": [strings],
  "missing_keywords": [strings a recruiter would search for],
  "missing_technical_skills": [strings],
  "recommended_roles": [strings],
  "salary_range": "e.g. $95k-$130k US remote",
  "structured": {
    "headline": "Candidate's main title/role",
    "skills": [strings],
    "experience": [{"company": "string", "title": "string", "period": "string", "bullets": [strings]}],
    "projects": [{"name": "string", "description": "string", "tech": [strings]}],
    "education": [{"school": "string", "degree": "string", "period": "string"}],
    "certifications": [strings],
    "achievements": [strings]
  }
}
Every insight must be personalized to the actual resume. No generic filler.`;

export const uploadAndAnalyzeResume = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ data, context }) => {
    const { extractResumeText } = await import("@/lib/resume-parser.server");
    const { geminiOcr } = await import("@/lib/gemini.server");
    const { groqJson } = await import("@/lib/groq.server");
    const { embed } = await import("@/lib/embeddings.server");

    const bin = Uint8Array.from(atob(data.contentBase64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 10 * 1024 * 1024) throw new Error("File exceeds 10MB limit");

    const resumeId = uuidv4();
    const safeName = data.fileName.replace(/[^a-z0-9.\-_]/gi, "_");
    const relativePath = `${context.userId}-${Date.now()}-${safeName}`;
    const fullPath = path.resolve(process.cwd(), ".data", "resumes", relativePath);
    fs.writeFileSync(fullPath, bin);

    let rawText = "";
    if (data.mimeType.startsWith("image/")) {
      rawText = await geminiOcr(data.contentBase64, data.mimeType);
    } else {
      rawText = await extractResumeText(bin.buffer as ArrayBuffer, data.mimeType, data.fileName);
    }
    if (!rawText || rawText.trim().length < 30) throw new Error("Could not extract meaningful text");
    rawText = rawText.slice(0, 30000);

    const analysis = await groqJson<any>({
      system: `You are Hirely.ai, an elite AI technical recruiter and resume evaluator.\n${ANALYSIS_SCHEMA}`,
      user: `Resume text:\n\n${rawText}`,
    });

    let vecStr: string | null = null;
    try {
      const vec = await embed(
        `${analysis.structured?.headline ?? ""}\n${analysis.summary ?? ""}\nSkills: ${(analysis.structured?.skills ?? []).join(", ")}\n${rawText.slice(0, 4000)}`
      );
      vecStr = JSON.stringify(vec);
    } catch (e) {
      console.warn("[resume embed skipped]", (e as Error).message);
    }

    db.prepare(`
      INSERT INTO resumes (id, user_id, file_name, storage_path, mime_type, raw_text, structured, embedding, label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      resumeId, context.userId, data.fileName, relativePath, data.mimeType, rawText,
      JSON.stringify(analysis.structured ?? {}), vecStr, "Original"
    );

    const analysisId = uuidv4();
    db.prepare(`
      INSERT INTO resume_analyses (id, resume_id, user_id, overall_score, ats_score, clarity, impact, summary, strengths, gaps, roadmap, raw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      analysisId, resumeId, context.userId,
      Math.round(analysis.overall_score ?? 0), Math.round(analysis.ats_score ?? 0),
      Math.round(analysis.clarity ?? 0), Math.round(analysis.impact ?? 0),
      analysis.summary ?? "", JSON.stringify(analysis.strengths ?? []),
      JSON.stringify(analysis.gaps ?? []), JSON.stringify(analysis.roadmap ?? []),
      JSON.stringify(analysis)
    );

    return {
      resumeId,
      analysis: {
        id: analysisId,
        overall_score: Math.round(analysis.overall_score ?? 0),
        ats_score: Math.round(analysis.ats_score ?? 0),
        clarity: Math.round(analysis.clarity ?? 0),
        impact: Math.round(analysis.impact ?? 0),
        summary: analysis.summary ?? "",
        strengths: analysis.strengths ?? [],
        gaps: analysis.gaps ?? [],
        roadmap: analysis.roadmap ?? [],
        raw: analysis,
      },
      structured: analysis.structured,
    };
  });

export const listMyResumes = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const resumes = db.prepare("SELECT id, file_name, created_at, structured, label, parent_id FROM resumes WHERE user_id = ? ORDER BY created_at DESC").all(context.userId) as any[];
    return resumes.map(r => {
      const analysis = db.prepare("SELECT id, overall_score, ats_score, clarity, impact, summary, strengths, gaps, roadmap, raw, created_at FROM resume_analyses WHERE resume_id = ? ORDER BY created_at DESC LIMIT 1").get(r.id) as any;
      return {
        ...r,
        structured: r.structured ? safeJson(r.structured) : null,
        resume_analyses: analysis ? [{
          ...analysis,
          strengths: analysis.strengths ? safeJson(analysis.strengths) : [],
          gaps: analysis.gaps ? safeJson(analysis.gaps) : [],
          roadmap: analysis.roadmap ? safeJson(analysis.roadmap) : [],
          raw: analysis.raw ? safeJson(analysis.raw) : null,
        }] : [],
      };
    });
  });

export const getResume = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = db.prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?").get(data.id, context.userId) as any;
    if (!r) return null;
    const analyses = db.prepare("SELECT * FROM resume_analyses WHERE resume_id = ? ORDER BY created_at DESC").all(r.id) as any[];
    return {
      ...r,
      structured: r.structured ? safeJson(r.structured) : null,
      resume_analyses: analyses.map(a => ({
        ...a,
        strengths: a.strengths ? safeJson(a.strengths) : [],
        gaps: a.gaps ? safeJson(a.gaps) : [],
        roadmap: a.roadmap ? safeJson(a.roadmap) : [],
        raw: a.raw ? safeJson(a.raw) : null,
      })),
    };
  });

const RewriteInput = z.object({
  resumeId: z.string(),
  target: z.enum(["summary", "experience", "projects", "skills", "bullets", "achievements", "education", "certifications"]),
  instructions: z.string().max(500).optional(),
});

export const rewriteResumeSection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => RewriteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { groqJson } = await import("@/lib/groq.server");
    const r = db.prepare("SELECT raw_text, structured FROM resumes WHERE id = ? AND user_id = ?").get(data.resumeId, context.userId) as any;
    if (!r) throw new Error("Resume not found");
    const structured = r.structured ? safeJson(r.structured) : {};
    const sectionData = (structured as any)?.[data.target] ?? null;
    const out = await groqJson<{ original: string; rewritten: string; notes: string[] }>({
      system: `You are an elite resume editor. Rewrite the given section with strong action verbs, quantified impact, ATS-friendly language, and clean professional formatting. Preserve truth — do not fabricate metrics. Return JSON {original, rewritten, notes:[3-5 short bullets on what changed and why]}.`,
      user: `Target section: ${data.target}\nExtra instructions: ${data.instructions ?? "none"}\n\nSection data (JSON): ${JSON.stringify(sectionData).slice(0, 4000)}\n\nFull resume text (for context):\n${(r.raw_text ?? "").slice(0, 3000)}`,
    });
    return out;
  });

const SaveVersionInput = z.object({
  parentId: z.string(),
  label: z.string().min(1).max(60),
  patch: z.record(z.string(), z.any()),
});

export const saveImprovedVersion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => SaveVersionInput.parse(d))
  .handler(async ({ data, context }) => {
    const parent = db.prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?").get(data.parentId, context.userId) as any;
    if (!parent) throw new Error("Parent resume not found");
    const structured = { ...(parent.structured ? safeJson(parent.structured) : {}), ...data.patch };
    const id = uuidv4();
    db.prepare(`
      INSERT INTO resumes (id, user_id, file_name, storage_path, mime_type, raw_text, structured, embedding, parent_id, label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, context.userId, parent.file_name, parent.storage_path, parent.mime_type,
      parent.raw_text, JSON.stringify(structured), parent.embedding, data.parentId, data.label
    );
    return { id, label: data.label };
  });

function safeJson(s: any) {
  if (typeof s !== "string") return s;
  try { return JSON.parse(s); } catch { return null; }
}
