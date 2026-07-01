import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAllCandidates, compareCandidates } from "@/lib/search.functions";

export const Route = createFileRoute("/recruiter/compare")({
  head: () => ({
    meta: [
      { title: "Compare — Hirely.ai Recruiter" },
      { name: "description", content: "Compare two candidates side by side with real AI reasoning." },
    ],
  }),
  component: ComparePage,
});

type Row = { resume_id: string; candidate_id: string; structured: any; profile: any; analysis: any };

function ComparePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<any>(null);
  const [loadingReasoning, setLoadingReasoning] = useState(false);
  const listFn = useServerFn(listAllCandidates);
  const cmpFn = useServerFn(compareCandidates);

  useEffect(() => {
    listFn().then((d) => {
      const mapped: Row[] = (d ?? []).map((r: any) => ({
        resume_id: r.id, candidate_id: r.user_id, structured: r.structured,
        profile: r.profile, analysis: r.resume_analyses?.[0] ?? null,
      }));
      setRows(mapped);
      setLeftId(mapped[0]?.resume_id ?? null);
      setRightId(mapped[1]?.resume_id ?? mapped[0]?.resume_id ?? null);
    }).catch(() => {});
  }, [listFn]);

  const L = rows.find((r) => r.resume_id === leftId) ?? null;
  const R = rows.find((r) => r.resume_id === rightId) ?? null;

  async function reason() {
    if (!L || !R) return;
    setLoadingReasoning(true);
    try {
      const res = await cmpFn({ data: { resumeIdA: L.resume_id, resumeIdB: R.resume_id } });
      setReasoning(res);
    } catch (e) { console.error(e); }
    setLoadingReasoning(false);
  }

  const winner = reasoning?.winner === "A" ? L : reasoning?.winner === "B" ? R : null;

  return (
    <main className="pt-24 pb-10 px-6 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="eyebrow mb-3">Compare</div>
            <h1 className="display-xl text-[5.5vw] leading-[0.95]">Two candidates. One decision.</h1>
          </div>
          <button onClick={reason} disabled={!L || !R || loadingReasoning}
            className="px-5 py-3 rounded-full bg-ink text-background text-[12px] tracking-wide hover:bg-black/85 disabled:opacity-40">
            {loadingReasoning ? "Reasoning…" : "Ask AI"}
          </button>
        </div>

        {rows.length < 2 ? (
          <div className="glass-panel rounded-2xl p-10 text-muted-foreground">
            Need at least 2 candidates uploaded to compare.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Column r={L!} others={rows} onChange={setLeftId} highlight={winner?.resume_id === L?.resume_id} label="A" />
              <Column r={R!} others={rows} onChange={setRightId} highlight={winner?.resume_id === R?.resume_id} label="B" />
            </div>
            {reasoning && (
              <div className="mt-10 glass-panel rounded-2xl p-8">
                <div className="eyebrow mb-3">AI reasoning</div>
                <p className="text-lg leading-relaxed">{reasoning.reasoning}</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Column({ r, others, onChange, highlight, label }: {
  r: Row; others: Row[]; onChange: (id: string) => void; highlight: boolean; label: string;
}) {
  const name = r.profile?.name ?? r.structured?.name ?? "Candidate";
  const score = r.analysis?.overall_score ?? 0;
  const s = r.structured ?? {};
  return (
    <motion.section key={r.resume_id}
      initial={{ opacity: 0, y: 8, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5 }}
      className={"glass-panel rounded-2xl p-8 " + (highlight ? "ring-1 ring-champagne/70" : "")}>
      <div className="flex items-center justify-between">
        <select value={r.resume_id} onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-[12px] tracking-widest uppercase text-muted-foreground outline-none">
          {others.map((o) => <option key={o.resume_id} value={o.resume_id}>{o.profile?.name ?? o.structured?.name ?? "Candidate"}</option>)}
        </select>
        {highlight && <span className="text-[10px] tracking-[.24em] uppercase text-champagne">Recommended</span>}
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <div className="eyebrow mb-1">Candidate {label}</div>
          <h2 className="text-3xl tracking-tight font-medium">{name}</h2>
          <div className="text-muted-foreground text-sm mt-1">{s.headline ?? ""}</div>
        </div>
        <div className="font-serif text-6xl leading-none">{score || "—"}</div>
      </div>

      <div className="hairline my-6" />
      {s.summary && <p className="text-[14.5px] leading-relaxed">{s.summary}</p>}

      {r.analysis?.strengths?.length > 0 && (
        <div className="mt-6">
          <div className="eyebrow mb-2">Strengths</div>
          <ul className="text-[13.5px] leading-relaxed space-y-1">{r.analysis.strengths.map((s: string, i: number) => <li key={i}>— {s}</li>)}</ul>
        </div>
      )}
      {r.analysis?.gaps?.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-2">Gaps</div>
          <ul className="text-[13.5px] leading-relaxed text-muted-foreground space-y-1">{r.analysis.gaps.map((s: string, i: number) => <li key={i}>— {s}</li>)}</ul>
        </div>
      )}

      {(s.skills ?? []).length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {s.skills.slice(0, 12).map((sk: string) => (
            <span key={sk} className="text-[11px] px-2.5 py-1 rounded-full border border-black/10">{sk}</span>
          ))}
        </div>
      )}
    </motion.section>
  );
}
