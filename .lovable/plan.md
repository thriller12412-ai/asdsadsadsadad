
The candidate portal already has upload + analysis + a basic interview screen wired to real AI. Right now those screens live in isolation and several journey steps you described don't exist yet. This plan connects them into one guided experience and fills in the gaps, without touching recruiter code or the landing/portal design.

## What I'll change

### 1. Journey shell — one continuous flow
- Add a persistent progress rail (Upload · Analyze · Role · Interview · Report) inside `/candidate` so the user always knows where they are.
- Rework `candidate.index.tsx` to hand off directly into the next step instead of a dead-end "Start Interview" link.

### 2. Resume upload + analysis (already partly built)
- Keep the drag/drop + paper-scan animation.
- Extend the Groq analysis schema to return every field you listed (ATS, technical, communication, project quality, leadership, formatting, grammar, recruiter appeal, missing keywords, missing skills, recommended roles, salary range, interview readiness). Persist as JSON on `resume_analyses.raw`.
- Rebuild the results screen: hero score + expandable sections for Experience / Projects / Education / Skills / Certifications / Achievements with per-section "Improve with AI" that calls `rewriteResumeSection` and shows original vs improved side-by-side.

### 3. New step — Target role + optional JD
- New route `/candidate/prepare` with:
  - Role picker (Frontend, Backend, AI, ML, SWE, Data, UI/UX, PM), experience level, company type.
  - Optional JD paste/upload → new server fn `analyzeJobFit` (Groq) returning match %, matching skills, missing skills, missing keywords, priority improvements, interview focus areas.
- Persist to a new `interview_preps` table so the interview can pull it.

### 4. Adaptive AI interview
- Rework `candidate.interview.tsx` into a focused, one-question-at-a-time studio (no chat feel).
- Interview mode picker before start: HR / Technical / Behavioral / Mixed / Mock Final.
- Server fn `nextQuestion` takes resume + role + JD focus + prior turns + running difficulty, returns the next question. Difficulty adjusts from the last turn's evaluation score.
- Both typing and voice input (Web Speech API already in place — polish + fallback).
- After each answer, call `evaluateTurn` (Groq JSON) → technical accuracy, communication, confidence, clarity, grammar, completeness, relevance, professionalism, STAR usage, structure, strengths, weaknesses, how-to-improve, better-answer example. Show inline after the answer, then advance.

### 5. Final interview report
- New route `/candidate/report/$interviewId`.
- Aggregates all turn evaluations via `finalizeInterview` server fn: overall + communication + technical + confidence + problem-solving + leadership + behavioral + culture fit + readiness + strengths + weaknesses + most impressive answer + weakest answer + recommended learning + projects + certifications + practice areas.
- Persist to existing `interview_results` (extend columns as needed via a migration in `db.server.ts`).

### 6. Resume improvement studio
- New route `/candidate/improve/$resumeId`: one-click rewrite for Summary / Experience / Projects / Achievements / Skills / Bullets, saved as a new resume version (row in `resumes` with `parent_id`). Original vs improved diff view.

### 7. Progress tracking + AI career coach
- Rework `/candidate/history` into a progress dashboard: interview history, resume versions, average scores, communication trend, technical trend, readiness progress, learning milestones.
- Store last-N mistakes/weak-skills summary on the profile (`profiles.coach_memory` JSON) and feed it into `nextQuestion` so questions don't repeat and difficulty ramps as the user improves.

## Technical notes (for reference)

- Runtime: the current backend uses `better-sqlite3` + local `fs` writes. That works in the Lovable dev preview (Node) but will not deploy to production (Cloudflare Workers). This plan keeps SQLite so the preview keeps working today; migrating storage to Lovable Cloud / Supabase is a separate follow-up when you want to publish.
- New tables: `interview_preps`, `resume_versions` (or `parent_id` on `resumes`). Extra columns on `interview_results` and `profiles.coach_memory`.
- New server fns in `src/lib/`: `analyzeJobFit`, `nextQuestion`, `evaluateTurn`, `finalizeInterview`, `improveResume` (wraps existing `rewriteResumeSection` for the multi-section flow), `getProgress`.
- All AI calls go through the existing `groqJson` helper; embeddings stay optional.
- Design language stays as-is: warm white, big serif numbers, glass panels, generous whitespace — no visual redesign of shipped surfaces beyond the new screens.

## Out of scope for this pass

- Migrating to Supabase/Lovable Cloud (call that out separately when you want to publish).
- Recruiter portal changes.
- Landing / portal visual changes.
