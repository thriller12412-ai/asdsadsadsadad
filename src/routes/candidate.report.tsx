import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getInterviewReport } from "@/lib/interviews.functions";

export const Route = createFileRoute("/candidate/report")({
  head: () => ({ meta: [{ title: "Interview Report — Hirely.ai" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    interviewId: typeof s.interviewId === "string" ? s.interviewId : undefined,
  }),
  component: ReportPage,
});

function ReportPage() {
  const { interviewId } = useSearch({ from: "/candidate/report" });
  const nav = useNavigate();
  const getFn = useServerFn(getInterviewReport);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!interviewId) { setLoading(false); return; }
    getFn({ data: { interviewId } }).then(r => { setReport(r); setLoading(false); }).catch(() => setLoading(false));
  }, [interviewId, getFn]);

  if (loading) return <div className="pt-40 text-center text-muted-foreground">Loading report…</div>;
  if (!report?.result) return (
    <div className="pt-40 text-center">
      <div className="text-muted-foreground mb-6">No report found.</div>
      <button onClick={() => nav({ to: "/candidate/history" })} className="text-ink underline">View history →</button>
    </div>
  );

  const r = report.result;
  const raw = r.raw ?? {};
  const turns = report.turns ?? [];
  const most = raw.most_impressive_answer;
  const weak = raw.weakest_answer;

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="pt-32 pb-24 px-6 md:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-center gap-3 mb-14">
          <span className="eyebrow">Report</span>
          <span className="hairline flex-1" />
          <span className="text-[11px] tracking-wide text-muted-foreground">{report.interview?.role_target} · {report.interview?.mode}</span>
        </div>

        <div className="grid grid-cols-12 gap-y-16 md:gap-x-10">
          <div className="col-span-12 md:col-span-7">
            <div className="eyebrow mb-6">Overall</div>
            <div className="flex items-end gap-6">
              <div className="font-serif text-[22vw] md:text-[16vw] leading-[0.8]">{r.overall_score}</div>
              <div className="pb-4 md:pb-8">
                <div className="text-lg md:text-xl">{r.overall_score >= 80 ? "Interview ready." : r.overall_score >= 60 ? "Nearly there." : "Keep practicing."}</div>
                <div className="text-sm text-muted-foreground mt-1 max-w-md">{r.summary || raw.summary}</div>
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-5 grid grid-cols-2 gap-6">
            <Cell label="Communication" v={r.communication} />
            <Cell label="Technical" v={r.technical} />
            <Cell label="Confidence" v={r.confidence} />
            <Cell label="Clarity" v={r.clarity} />
            <Cell label="Problem-solving" v={r.problem_solving} />
            <Cell label="Leadership" v={r.leadership} />
            <Cell label="Behavioral" v={r.behavioral} />
            <Cell label="Culture fit" v={r.culture_fit} />
            <Cell label="Readiness" v={r.readiness} />
            <Cell label="STAR" v={r.star} />
          </div>
        </div>

        <div className="h-20" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <List title="Strengths" items={r.strengths ?? []} />
          <List title="Improvements" items={r.improvements ?? []} muted />
        </div>

        <div className="h-20" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <HighlightAnswer title="Most impressive answer" info={most} turns={turns} />
          <HighlightAnswer title="Weakest answer" info={weak} turns={turns} muted />
        </div>

        <div className="h-20" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <List title="Recommended learning" items={raw.recommended_learning ?? []} />
          <List title="Recommended projects" items={raw.recommended_projects ?? []} />
          <List title="Suggested certifications" items={raw.suggested_certifications ?? []} />
        </div>

        <div className="h-20" />
        <div>
          <div className="eyebrow mb-6">Full turn-by-turn</div>
          <div className="divide-y divide-black/10">
            {turns.map((t: any) => (
              <div key={t.idx} className="py-6 grid grid-cols-12 gap-6 items-start">
                <div className="col-span-1 font-serif text-2xl text-muted-foreground">{String(t.idx + 1).padStart(2, "0")}</div>
                <div className="col-span-11 md:col-span-8">
                  <div className="text-[11px] tracking-[.22em] uppercase text-muted-foreground mb-1">Question</div>
                  <div className="text-lg">{t.question}</div>
                  <div className="text-[11px] tracking-[.22em] uppercase text-muted-foreground mt-4 mb-1">Your answer</div>
                  <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{t.answer_transcript}</div>
                </div>
                <div className="col-span-12 md:col-span-3 text-right">
                  <div className="font-serif text-4xl">{t.evaluation?.overall ?? "—"}</div>
                  <div className="text-[11px] tracking-[.22em] uppercase text-muted-foreground mt-1">this answer</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-24" />
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-black/10 pt-8">
          <div className="flex items-center gap-6">
            <Link to="/candidate/history" className="text-[13px] text-muted-foreground hover:text-ink">← History</Link>
            <Link to="/candidate" className="text-[13px] text-muted-foreground hover:text-ink">Studio</Link>
          </div>
          <div className="flex items-center gap-4">
            {report.interview?.resume_id && (
              <Link to="/candidate/improve" search={{ resumeId: report.interview.resume_id } as any}
                className="px-6 py-3 rounded-full border border-black/15 text-[13px] hover:border-black/40 transition-colors">
                Improve resume →
              </Link>
            )}
            <Link to="/candidate/prepare" search={{ resumeId: report.interview?.resume_id ?? undefined } as any}
              className="px-6 py-3 rounded-full bg-ink text-background text-[13px] hover:bg-black/85 transition-colors">
              Another round →
            </Link>
          </div>
        </div>
      </div>
    </motion.main>
  );
}

function Cell({ label, v }: { label: string; v: number | undefined }) {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div className="font-serif text-3xl">{Math.round(Number(v ?? 0))}</div>
    </div>
  );
}
function List({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div>
      <div className="eyebrow mb-4">{title}</div>
      {items.length === 0 ? <div className="text-sm text-muted-foreground">—</div> : (
        <ul className={"space-y-3 " + (muted ? "text-muted-foreground" : "")}>
          {items.map((s, i) => <li key={i} className="flex gap-3"><span className="mt-3 w-4 h-px bg-current opacity-40" /><span>{s}</span></li>)}
        </ul>
      )}
    </div>
  );
}
function HighlightAnswer({ title, info, turns, muted }: { title: string; info: any; turns: any[]; muted?: boolean }) {
  if (!info) return <div><div className="eyebrow mb-4">{title}</div><div className="text-sm text-muted-foreground">—</div></div>;
  const t = turns?.[info.idx];
  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="eyebrow mb-2">{title}</div>
      <div className="text-lg mb-3">{t?.question ?? `Q${info.idx + 1}`}</div>
      <div className={"text-sm mb-4 " + (muted ? "text-muted-foreground" : "text-ink")}>{info.why}</div>
      {t?.answer_transcript && <div className="text-[13px] text-muted-foreground leading-relaxed border-l-2 border-black/10 pl-4">{t.answer_transcript.slice(0, 400)}{t.answer_transcript.length > 400 ? "…" : ""}</div>}
    </div>
  );
}
