import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db.server";
import { v4 as uuidv4 } from "uuid";

type Turn = { idx: number; question: string; answer_transcript: string | null; evaluation: string | null; difficulty: number | null };

const MAX_QUESTIONS = 7;

const StartInput = z.object({
  prepId: z.string().optional(),
  resumeId: z.string().optional(),
  roleTarget: z.string().min(1).max(120),
  mode: z.enum(["HR", "Technical", "Behavioral", "Mixed", "Mock Final"]).default("Mixed"),
});

function buildContext(userId: string, resumeId: string | null | undefined, prepId: string | null | undefined) {
  let resumeCtx = "";
  let jdCtx = "";
  let focusAreas: string[] = [];
  let coachMemory = "";
  if (resumeId) {
    const r = db.prepare("SELECT structured, raw_text FROM resumes WHERE id = ? AND user_id = ?").get(resumeId, userId) as any;
    if (r) resumeCtx = ((r.structured ?? "") + "\n" + (r.raw_text ?? "")).slice(0, 5000);
  }
  if (prepId) {
    const p = db.prepare("SELECT jd_text, jd_analysis FROM interview_preps WHERE id = ? AND user_id = ?").get(prepId, userId) as any;
    if (p) {
      jdCtx = (p.jd_text ?? "").slice(0, 3000);
      try {
        const a = p.jd_analysis ? JSON.parse(p.jd_analysis) : null;
        if (a?.interview_focus_areas) focusAreas = a.interview_focus_areas;
      } catch {}
    }
  }
  const prof = db.prepare("SELECT coach_memory FROM profiles WHERE user_id = ?").get(userId) as any;
  if (prof?.coach_memory) coachMemory = prof.coach_memory.slice(0, 1500);
  return { resumeCtx, jdCtx, focusAreas, coachMemory };
}

export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    const { groqJson } = await import("@/lib/groq.server");
    const ctx = buildContext(context.userId, data.resumeId, data.prepId);

    const interviewId = uuidv4();
    db.prepare(`INSERT INTO interviews (id, user_id, resume_id, role_target, status, prep_id, mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      interviewId, context.userId, data.resumeId ?? null, data.roleTarget, "active",
      data.prepId ?? null, data.mode
    );

    const q = await groqJson<{ question: string }>({
      system: `You are a top-tier ${data.mode} interviewer for a ${data.roleTarget} role. Ask EXACTLY ONE opening question, tailored to this specific candidate's resume. Do not number the question. Do not ask multiple questions. Return JSON {question}.
Focus areas from JD (if any): ${focusList(ctx.focusAreas)}
Avoid repeating any topic the candidate has already covered in prior sessions (coach memory): ${ctx.coachMemory || "(none)"}.`,
      user: `Resume:\n${ctx.resumeCtx || "(none)"}\n\nJob description:\n${ctx.jdCtx || "(none)"}`,
    });

    db.prepare("INSERT INTO interview_turns (id, interview_id, idx, question, difficulty) VALUES (?, ?, ?, ?, ?)").run(
      uuidv4(), interviewId, 0, q.question, 50
    );

    return { interviewId, question: q.question, idx: 0, mode: data.mode };
  });

const AnswerInput = z.object({
  interviewId: z.string(),
  idx: z.number().int().min(0),
  transcript: z.string().min(1).max(8000),
});

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => AnswerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { groqJson } = await import("@/lib/groq.server");
    const itv = db.prepare("SELECT id, role_target, mode, resume_id, prep_id FROM interviews WHERE id = ? AND user_id = ?").get(data.interviewId, context.userId) as any;
    if (!itv) throw new Error("Interview not found");

    const currentTurn = db.prepare("SELECT question, difficulty FROM interview_turns WHERE interview_id = ? AND idx = ?").get(data.interviewId, data.idx) as any;
    const currentDifficulty = currentTurn?.difficulty ?? 50;

    const evaluation = await groqJson<any>({
      system: `You are a rigorous interview evaluator for a ${itv.role_target} ${itv.mode} interview. Score the answer 0-100 on every axis and return JSON:
{
  "technical_accuracy": number,
  "communication": number,
  "confidence": number,
  "clarity": number,
  "grammar": number,
  "completeness": number,
  "relevance": number,
  "professionalism": number,
  "star_usage": number,
  "structure": number,
  "overall": number,
  "strengths": [2-4 short bullets],
  "weaknesses": [2-4 short bullets],
  "how_to_improve": [2-4 concrete actions],
  "better_answer_example": "A concise example of a stronger answer (3-5 sentences)."
}`,
      user: `Question: ${currentTurn?.question}\n\nCandidate answer:\n${data.transcript}`,
    });

    db.prepare("UPDATE interview_turns SET answer_transcript = ?, evaluation = ? WHERE interview_id = ? AND idx = ?").run(
      data.transcript, JSON.stringify(evaluation), data.interviewId, data.idx
    );

    const prevTurns = db.prepare("SELECT idx, question, answer_transcript, evaluation, difficulty FROM interview_turns WHERE interview_id = ? ORDER BY idx ASC").all(data.interviewId) as Turn[];

    if (prevTurns.length >= MAX_QUESTIONS) {
      return { done: true, evaluation };
    }

    // Adaptive difficulty: if answer > 75 overall, raise; if < 50, lower.
    const overall = Number(evaluation.overall ?? 60);
    let nextDifficulty = currentDifficulty;
    if (overall >= 75) nextDifficulty = Math.min(95, currentDifficulty + 12);
    else if (overall < 50) nextDifficulty = Math.max(25, currentDifficulty - 10);

    const ctx = buildContext(context.userId, itv.resume_id, itv.prep_id);
    const asked = prevTurns.map(t => t.question);

    const next = await groqJson<{ question: string }>({
      system: `You are a top-tier ${itv.mode} interviewer for a ${itv.role_target} role.
Adaptive rules:
- Target difficulty: ${nextDifficulty}/100 (higher = deeper follow-up / trickier scenario).
- If candidate is struggling, encourage briefly then simplify.
- If candidate is confident, probe deeper or shift to a weaker area.
Ask EXACTLY ONE next question. Do not number it. Do not repeat any topic already asked: ${JSON.stringify(asked).slice(0, 1500)}.
Return JSON {question}.`,
      user: `Prior turns: ${JSON.stringify(prevTurns).slice(0, 5000)}\n\nResume:\n${ctx.resumeCtx || "(none)"}\n\nJD focus areas: ${focusList(ctx.focusAreas)}`,
    });

    const nextIdx = data.idx + 1;
    db.prepare("INSERT INTO interview_turns (id, interview_id, idx, question, difficulty) VALUES (?, ?, ?, ?, ?)").run(
      uuidv4(), data.interviewId, nextIdx, next.question, nextDifficulty
    );

    return { done: false, evaluation, question: next.question, idx: nextIdx, difficulty: nextDifficulty };
  });

export const finalizeInterview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ interviewId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { groqJson } = await import("@/lib/groq.server");

    const turns = db.prepare("SELECT idx, question, answer_transcript, evaluation FROM interview_turns WHERE interview_id = ? ORDER BY idx ASC").all(data.interviewId) as any[];
    const itv = db.prepare("SELECT role_target, mode FROM interviews WHERE id = ? AND user_id = ?").get(data.interviewId, context.userId) as any;
    if (!itv) throw new Error("Interview not found");

    const result = await groqJson<any>({
      system: `Synthesize the full ${itv.mode} interview for a ${itv.role_target} role. Return JSON:
{
  "overall_score": number,
  "communication": number,
  "technical": number,
  "confidence": number,
  "clarity": number,
  "problem_solving": number,
  "leadership": number,
  "behavioral": number,
  "culture_fit": number,
  "readiness": number,
  "star": number,
  "summary": "3-4 sentences on how the candidate performed",
  "strengths": [4-6 specific strings],
  "improvements": [4-6 specific strings],
  "most_impressive_answer": { "idx": number, "why": "string" },
  "weakest_answer": { "idx": number, "why": "string" },
  "recommended_learning": [strings — specific topics],
  "recommended_projects": [strings — concrete project ideas],
  "suggested_certifications": [strings],
  "practice_areas": [strings]
}
All scores 0-100. Every insight must reference the actual answers.`,
      user: `Turns:\n${JSON.stringify(turns).slice(0, 15000)}`,
    });

    db.prepare(`
      INSERT INTO interview_results (id, interview_id, overall_score, communication, technical, star, confidence, clarity, summary, strengths, improvements, raw, problem_solving, leadership, behavioral, culture_fit, readiness)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(interview_id) DO UPDATE SET
        overall_score=excluded.overall_score, communication=excluded.communication, technical=excluded.technical, star=excluded.star, confidence=excluded.confidence, clarity=excluded.clarity, summary=excluded.summary, strengths=excluded.strengths, improvements=excluded.improvements, raw=excluded.raw, problem_solving=excluded.problem_solving, leadership=excluded.leadership, behavioral=excluded.behavioral, culture_fit=excluded.culture_fit, readiness=excluded.readiness
    `).run(
      uuidv4(), data.interviewId,
      r(result.overall_score), r(result.communication), r(result.technical), r(result.star), r(result.confidence), r(result.clarity),
      result.summary ?? "", JSON.stringify(result.strengths ?? []), JSON.stringify(result.improvements ?? []), JSON.stringify(result),
      r(result.problem_solving), r(result.leadership), r(result.behavioral), r(result.culture_fit), r(result.readiness)
    );

    db.prepare("UPDATE interviews SET status = 'complete', ended_at = CURRENT_TIMESTAMP WHERE id = ?").run(data.interviewId);

    // Update coach memory (weak areas + topics covered) on the profile.
    try {
      const weak = (result.improvements ?? []).slice(0, 4).join(" | ");
      const covered = turns.map((t: any) => (t.question ?? "").slice(0, 80)).join(" | ");
      const prof = db.prepare("SELECT coach_memory FROM profiles WHERE user_id = ?").get(context.userId) as any;
      const prev = prof?.coach_memory ?? "";
      const merged = (`WEAK: ${weak}\nCOVERED: ${covered}\n---\n${prev}`).slice(0, 4000);
      db.prepare("UPDATE profiles SET coach_memory = ? WHERE user_id = ?").run(merged, context.userId);
    } catch (e) { console.warn("[coach memory update failed]", (e as Error).message); }

    return { ...result, interviewId: data.interviewId };
  });

function r(n: any) { return Math.round(Number(n ?? 0)) || 0; }
function focusList(a: string[]) { return a && a.length ? a.join(", ") : "(none)"; }

export const listMyInterviews = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const data = db.prepare("SELECT id, role_target, mode, status, started_at, ended_at FROM interviews WHERE user_id = ? ORDER BY started_at DESC").all(context.userId) as any[];
    return data.map(i => {
      const result = db.prepare("SELECT overall_score, communication, technical, confidence, clarity, readiness, summary FROM interview_results WHERE interview_id = ?").get(i.id) as any;
      return { ...i, interview_results: result ? [result] : [] };
    });
  });

export const getInterviewReport = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ interviewId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const itv = db.prepare("SELECT * FROM interviews WHERE id = ? AND user_id = ?").get(data.interviewId, context.userId) as any;
    if (!itv) return null;
    const result = db.prepare("SELECT * FROM interview_results WHERE interview_id = ?").get(data.interviewId) as any;
    const turns = db.prepare("SELECT idx, question, answer_transcript, evaluation, difficulty FROM interview_turns WHERE interview_id = ? ORDER BY idx ASC").all(data.interviewId) as any[];
    return {
      interview: itv,
      result: result ? {
        ...result,
        strengths: safeJson(result.strengths) ?? [],
        improvements: safeJson(result.improvements) ?? [],
        raw: safeJson(result.raw) ?? null,
      } : null,
      turns: turns.map(t => ({ ...t, evaluation: safeJson(t.evaluation) })),
    };
  });

function safeJson(s: any) { if (typeof s !== "string") return s; try { return JSON.parse(s); } catch { return null; } }
