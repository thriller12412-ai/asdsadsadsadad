import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db.server";
import { v4 as uuidv4 } from "uuid";

const PrepInput = z.object({
  resumeId: z.string().optional(),
  roleTarget: z.string().min(1).max(120),
  experienceLevel: z.enum(["Intern", "Junior", "Mid", "Senior", "Staff", "Principal"]).optional(),
  companyType: z.enum(["Startup", "Mid-size", "Enterprise", "Remote", "Hybrid", "Any"]).optional(),
  mode: z.enum(["HR", "Technical", "Behavioral", "Mixed", "Mock Final"]).default("Mixed"),
  jdText: z.string().max(20000).optional(),
});

export const savePrep = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => PrepInput.parse(d))
  .handler(async ({ data, context }) => {
    const { groqJson } = await import("@/lib/groq.server");
    let jdAnalysis: any = null;
    if (data.jdText && data.jdText.trim().length > 30) {
      let resumeCtx = "";
      if (data.resumeId) {
        const r = db.prepare("SELECT structured, raw_text FROM resumes WHERE id = ? AND user_id = ?").get(data.resumeId, context.userId) as any;
        if (r) resumeCtx = (r.structured ?? "") + "\n\n" + (r.raw_text ?? "").slice(0, 4000);
      }
      jdAnalysis = await groqJson<any>({
        system: `You are an expert recruiter comparing a candidate resume to a job description. Return JSON:
{
  "match_percent": number (0-100),
  "matching_skills": [strings],
  "missing_skills": [strings],
  "missing_keywords": [strings],
  "priority_improvements": [strings],
  "interview_focus_areas": [strings — the 4-6 topics THIS interview should probe]
}
Be specific to both the resume and the JD; no generic advice.`,
        user: `Job description:\n${data.jdText}\n\nResume context:\n${resumeCtx || "(no resume provided)"}`,
      });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO interview_preps (id, user_id, resume_id, role_target, experience_level, company_type, mode, jd_text, jd_analysis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, context.userId, data.resumeId ?? null, data.roleTarget,
      data.experienceLevel ?? null, data.companyType ?? null, data.mode,
      data.jdText ?? null, jdAnalysis ? JSON.stringify(jdAnalysis) : null
    );

    return { prepId: id, jdAnalysis };
  });

export const getPrep = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = db.prepare("SELECT * FROM interview_preps WHERE id = ? AND user_id = ?").get(data.id, context.userId) as any;
    if (!p) return null;
    return {
      ...p,
      jd_analysis: p.jd_analysis ? safeJson(p.jd_analysis) : null,
    };
  });

function safeJson(s: string) { try { return JSON.parse(s); } catch { return null; } }
