import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db.server";
import { v4 as uuidv4 } from "uuid";
import { cosineSimilarity } from "@/lib/vector-math";

const SearchInput = z.object({ query: z.string().min(1).max(500), limit: z.number().int().min(1).max(50).default(20) });

export const searchCandidates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { embed } = await import("@/lib/embeddings.server");
    if (context.role !== "recruiter") throw new Error("Recruiter role required");

    const vec = await embed(data.query);

    // Fetch all resumes with embeddings
    const allResumes = db.prepare("SELECT id, user_id, structured, embedding FROM resumes WHERE embedding IS NOT NULL").all() as any[];
    
    // Calculate cosine similarity in-memory
    const matches = allResumes.map(r => {
      let rVec: number[] = [];
      try { rVec = JSON.parse(r.embedding); } catch {}
      return {
        resume_id: r.id,
        user_id: r.user_id,
        similarity: cosineSimilarity(vec, rVec),
        structured: r.structured ? JSON.parse(r.structured) : null
      };
    }).sort((a, b) => b.similarity - a.similarity).slice(0, data.limit);

    return matches.map(m => {
      const profile = db.prepare("SELECT user_id, name, email, headline, avatar_url FROM profiles WHERE user_id = ?").get(m.user_id) as any;
      const analysis = db.prepare("SELECT resume_id, overall_score, summary, strengths, gaps FROM resume_analyses WHERE resume_id = ?").get(m.resume_id) as any;
      return {
        ...m,
        candidate_id: m.user_id,
        profile,
        analysis: analysis ? {
          ...analysis,
          strengths: analysis.strengths ? JSON.parse(analysis.strengths) : [],
          gaps: analysis.gaps ? JSON.parse(analysis.gaps) : []
        } : null
      };
    });
  });

export const listAllCandidates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.role !== "recruiter") throw new Error("Recruiter role required");
    const data = db.prepare("SELECT id, user_id, file_name, created_at, structured FROM resumes ORDER BY created_at DESC LIMIT 100").all() as any[];
    return data.map(r => {
      const profile = db.prepare("SELECT user_id, name, email, headline FROM profiles WHERE user_id = ?").get(r.user_id) as any;
      const analysis = db.prepare("SELECT overall_score, summary, strengths, gaps FROM resume_analyses WHERE resume_id = ?").get(r.id) as any;
      return {
        ...r,
        structured: r.structured ? JSON.parse(r.structured) : null,
        profile,
        resume_analyses: analysis ? [{
          ...analysis,
          strengths: analysis.strengths ? JSON.parse(analysis.strengths) : [],
          gaps: analysis.gaps ? JSON.parse(analysis.gaps) : []
        }] : []
      };
    });
  });

export const compareCandidates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z.object({ resumeIdA: z.string(), resumeIdB: z.string(), jobDescription: z.string().max(4000).optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { groqJson } = await import("@/lib/groq.server");
    const a = db.prepare("SELECT structured, raw_text FROM resumes WHERE id = ?").get(data.resumeIdA) as any;
    const b = db.prepare("SELECT structured, raw_text FROM resumes WHERE id = ?").get(data.resumeIdB) as any;
    
    return groqJson<{
      winner: "A" | "B" | "tie";
      reasoning: string;
      candidateA: { strengths: string[]; gaps: string[] };
      candidateB: { strengths: string[]; gaps: string[] };
    }>({
      system: `Compare two candidates for a role and return JSON {winner: "A"|"B"|"tie", reasoning, candidateA{strengths[],gaps[]}, candidateB{strengths[],gaps[]}}.`,
      user: `Job: ${data.jobDescription ?? "General senior role"}\n\nCandidate A: ${a?.structured?.slice(0, 4000)}\n\nCandidate B: ${b?.structured?.slice(0, 4000)}`,
    });
  });

const EmailInput = z.object({
  candidateId: z.string(),
  resumeId: z.string(),
  jobContext: z.string().max(2000).optional(),
  tone: z.enum(["warm", "direct", "casual", "executive"]).default("warm"),
});

export const draftOutreachEmail = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => EmailInput.parse(d))
  .handler(async ({ data, context }) => {
    const { groqJson } = await import("@/lib/groq.server");
    const resume = db.prepare("SELECT structured FROM resumes WHERE id = ?").get(data.resumeId) as any;
    const profile = db.prepare("SELECT name, email FROM profiles WHERE user_id = ?").get(data.candidateId) as any;

    const email = await groqJson<{ subject: string; body: string }>({
      system: `Draft a personalized recruiter outreach email. Warm, specific to the candidate's projects/experience. Tone: ${data.tone}. Return JSON {subject, body}.`,
      user: `Candidate: ${profile?.name ?? "Candidate"}\nResume: ${resume?.structured?.slice(0, 3500)}\nJob context: ${data.jobContext ?? "Open role"}`,
    });

    db.prepare("INSERT INTO outreach_emails (id, recruiter_id, candidate_id, subject, body) VALUES (?, ?, ?, ?, ?)").run(
      uuidv4(), context.userId, data.candidateId, email.subject, email.body
    );
    return email;
  });

