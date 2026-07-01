import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db.server";
import { v4 as uuidv4 } from "uuid";
import { cosineSimilarity } from "@/lib/vector-math";

const CreateJobInput = z.object({
  title: z.string().min(2).max(160),
  description: z.string().min(20).max(20000),
});

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => CreateJobInput.parse(d))
  .handler(async ({ data, context }) => {
    const { groqJson } = await import("@/lib/groq.server");
    const { embed } = await import("@/lib/embeddings.server");

    // Extract structured requirements
    const req = await groqJson<{
      must_have_skills: string[];
      nice_to_have: string[];
      experience_years: number;
      seniority: string;
      keywords: string[];
    }>({
      system: `Extract structured requirements from the job description. Return JSON {must_have_skills[], nice_to_have[], experience_years, seniority, keywords[]}.`,
      user: data.description,
    });

    let vecStr: string | null = null;
    try {
      const vec = await embed(`${data.title}\n${data.description}\nSkills: ${req.must_have_skills.join(", ")}`);
      vecStr = JSON.stringify(vec);
    } catch (e) {
      console.warn("[job embed skipped]", (e as Error).message);
    }

    const jobId = uuidv4();
    db.prepare(`
      INSERT INTO jobs (id, recruiter_id, title, description, requirements, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      jobId, context.userId, data.title, data.description, JSON.stringify(req), vecStr
    );

    return db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as any;
  });

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const data = db.prepare("SELECT id, title, description, requirements, created_at FROM jobs WHERE recruiter_id = ? ORDER BY created_at DESC").all(context.userId) as any[];
    return data.map(d => ({
      ...d,
      requirements: d.requirements ? JSON.parse(d.requirements) : null
    }));
  });

// Match a specific job against all resumes: embeds→cosine + Groq reasoning for top N.
const MatchInput = z.object({ jobId: z.string(), topN: z.number().int().min(1).max(50).default(10) });
export const matchJob = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => MatchInput.parse(d))
  .handler(async ({ data }) => {
    const { groqJson } = await import("@/lib/groq.server");

    const job = db.prepare("SELECT *, embedding FROM jobs WHERE id = ?").get(data.jobId) as any;
    if (!job) throw new Error("Job not found");
    if (!job.embedding) throw new Error("Job has no embedding yet");

    let jobVec: number[] = [];
    try { jobVec = JSON.parse(job.embedding); } catch {}

    const allResumes = db.prepare("SELECT id, user_id, structured, embedding FROM resumes WHERE embedding IS NOT NULL").all() as any[];

    const candidates = allResumes.map(r => {
      let rVec: number[] = [];
      try { rVec = JSON.parse(r.embedding); } catch {}
      return {
        resume_id: r.id,
        user_id: r.user_id,
        similarity: cosineSimilarity(jobVec, rVec),
        structured: r.structured ? JSON.parse(r.structured) : null
      };
    }).sort((a, b) => b.similarity - a.similarity).slice(0, data.topN);

    const results = [];
    for (const c of candidates) {
      const reasoning = await groqJson<{
        score: number;
        matching_skills: string[];
        missing_skills: string[];
        summary: string;
      }>({
        system: `Given a job and a resume, return JSON {score 0-100, matching_skills[], missing_skills[], summary (1-2 sentences)} explaining the fit.`,
        user: `Job title: ${job.title}\nRequirements: ${job.requirements}\n\nResume: ${JSON.stringify(c.structured).slice(0, 5000)}`,
      });

      db.prepare(`
        INSERT INTO job_matches (id, job_id, resume_id, candidate_id, score, matching_skills, missing_skills, reasoning)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id, resume_id) DO UPDATE SET
          score=excluded.score, matching_skills=excluded.matching_skills, missing_skills=excluded.missing_skills, reasoning=excluded.reasoning
      `).run(
        uuidv4(), data.jobId, c.resume_id, c.user_id, Math.round(reasoning.score), JSON.stringify(reasoning.matching_skills), JSON.stringify(reasoning.missing_skills), reasoning.summary
      );
      
      results.push({
        resume_id: c.resume_id,
        candidate_id: c.user_id,
        similarity: c.similarity,
        ...reasoning,
      });
    }
    return { jobId: data.jobId, results };
  });

