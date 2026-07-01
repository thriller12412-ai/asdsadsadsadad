import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db.server";
import { v4 as uuidv4 } from "uuid";

const StageInput = z.object({
  candidateId: z.string(),
  jobId: z.string().optional(),
  stage: z.enum(["Applied", "Screening", "Interview", "Offer", "Hired"]),
});

export const setPipelineStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => StageInput.parse(d))
  .handler(async ({ data, context }) => {
    // SQLite upsert-like logic
    const existing = db.prepare("SELECT id FROM pipeline_stages WHERE recruiter_id = ? AND candidate_id = ? AND job_id = ?").get(context.userId, data.candidateId, data.jobId || null) as any;
    if (existing) {
      db.prepare("UPDATE pipeline_stages SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(data.stage, existing.id);
    } else {
      db.prepare("INSERT INTO pipeline_stages (id, recruiter_id, candidate_id, job_id, stage) VALUES (?, ?, ?, ?, ?)").run(
        uuidv4(), context.userId, data.candidateId, data.jobId || null, data.stage
      );
    }
    return { ok: true };
  });

export const getPipeline = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const stages = db.prepare("SELECT * FROM pipeline_stages WHERE recruiter_id = ?").all(context.userId) as any[];
    return stages.map((s) => {
      const profile = db.prepare("SELECT user_id, name, email, headline FROM profiles WHERE user_id = ?").get(s.candidate_id) as any;
      const analysis = db.prepare("SELECT overall_score FROM resume_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(s.candidate_id) as any;
      return {
        ...s,
        profile: profile ?? null,
        score: analysis?.overall_score ?? null,
      };
    });
  });

export const recruiterAnalytics = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.role !== "recruiter") throw new Error("Recruiter role required");

    const resumes = (db.prepare("SELECT count(*) as count FROM resumes").get() as any).count;
    const interviews = (db.prepare("SELECT count(*) as count FROM interviews").get() as any).count;
    const stages = db.prepare("SELECT stage FROM pipeline_stages WHERE recruiter_id = ?").all(context.userId) as any[];
    
    // Instead of querying analytics_events, just query resumes since they're the same in this context
    const events = db.prepare("SELECT created_at FROM resumes WHERE created_at >= datetime('now', '-84 days')").all() as any[];

    const funnel = {
      Applications: resumes ?? 0,
      Screening: stages.filter((s) => s.stage === "Screening").length,
      Interview: stages.filter((s) => s.stage === "Interview").length,
      Offer: stages.filter((s) => s.stage === "Offer").length,
      Hired: stages.filter((s) => s.stage === "Hired").length,
    };

    const weeks: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const key = d.toISOString().slice(0, 10);
      weeks[key] = 0;
    }
    for (const e of events) {
      const d = new Date(e.created_at);
      const weekIdx = Math.floor((Date.now() - d.getTime()) / (7 * 24 * 3600 * 1000));
      const targetIdx = 11 - weekIdx;
      const keys = Object.keys(weeks);
      if (targetIdx >= 0 && targetIdx < keys.length) weeks[keys[targetIdx]]++;
    }

    return {
      funnel,
      trend: Object.entries(weeks).map(([week, count]) => ({ week, count })),
      totals: { resumes, interviews },
    };
  });
