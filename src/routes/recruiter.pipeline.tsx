import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPipeline, setPipelineStage } from "@/lib/recruiter.functions";
import { listAllCandidates } from "@/lib/search.functions";

export const Route = createFileRoute("/recruiter/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Hirely.ai Recruiter" },
      { name: "description", content: "A visual, drag-and-drop hiring pipeline backed by your real data." },
    ],
  }),
  component: PipelinePage,
});

const STAGES = ["Applied", "Screening", "Interview", "Offer", "Hired"] as const;
type Stage = typeof STAGES[number];

type Card = { candidate_id: string; name: string; headline: string; score: number | null; stage: Stage };

function PipelinePage() {
  const [board, setBoard] = useState<Record<Stage, Card[]>>({ Applied: [], Screening: [], Interview: [], Offer: [], Hired: [] });
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);

  const pipelineFn = useServerFn(getPipeline);
  const listFn = useServerFn(listAllCandidates);
  const setStageFn = useServerFn(setPipelineStage);

  useEffect(() => {
    Promise.all([pipelineFn(), listFn()]).then(([stages, all]) => {
      const staged = new Map<string, Stage>();
      for (const s of (stages as any[])) staged.set(s.candidate_id, s.stage as Stage);
      const next: Record<Stage, Card[]> = { Applied: [], Screening: [], Interview: [], Offer: [], Hired: [] };
      const seen = new Set<string>();
      // Existing stages
      for (const s of (stages as any[])) {
        const stage = (STAGES as readonly string[]).includes(s.stage) ? (s.stage as Stage) : "Applied";
        if (seen.has(s.candidate_id)) continue;
        seen.add(s.candidate_id);
        next[stage].push({
          candidate_id: s.candidate_id,
          name: s.profile?.name ?? "Candidate",
          headline: s.profile?.headline ?? "",
          score: s.score ?? null,
          stage,
        });
      }
      // Unstaged candidates → Applied
      for (const r of (all as any[])) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        next.Applied.push({
          candidate_id: r.user_id,
          name: r.profile?.name ?? r.structured?.name ?? "Candidate",
          headline: r.profile?.headline ?? r.structured?.headline ?? "",
          score: r.resume_analyses?.[0]?.overall_score ?? null,
          stage: "Applied",
        });
      }
      setBoard(next);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pipelineFn, listFn]);

  async function move(candidateId: string, to: Stage) {
    setBoard((prev) => {
      const next: Record<Stage, Card[]> = { Applied: [], Screening: [], Interview: [], Offer: [], Hired: [] };
      let moved: Card | null = null;
      for (const s of STAGES) for (const c of prev[s]) {
        if (c.candidate_id === candidateId) { moved = { ...c, stage: to }; continue; }
        next[s].push(c);
      }
      if (moved) next[to].push(moved);
      return next;
    });
    try { await setStageFn({ data: { candidateId, stage: to } }); } catch (e) { console.error(e); }
  }

  return (
    <main className="pt-24 pb-10 px-6 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="eyebrow mb-3">Pipeline</div>
            <h1 className="display-xl text-[5.5vw] leading-[0.95]">Move the pieces.</h1>
          </div>
          <div className="text-sm text-muted-foreground">Drag candidates between stages. Changes persist.</div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {STAGES.map((s) => (
              <div key={s}
                onDragOver={(e) => { e.preventDefault(); setOver(s); }}
                onDragLeave={() => setOver((o) => (o === s ? null : o))}
                onDrop={() => { if (dragging) move(dragging, s); setDragging(null); setOver(null); }}
                className={"rounded-2xl p-3 min-h-[420px] transition-all " +
                  (over === s ? "bg-black/[0.05] ring-1 ring-ink/20" : "bg-black/[0.02]")}>
                <div className="px-2 py-2 flex items-center justify-between">
                  <div className="eyebrow">{s}</div>
                  <div className="text-[11px] text-muted-foreground">{board[s].length}</div>
                </div>
                <div className="mt-2 space-y-2">
                  {board[s].map((c) => (
                    <motion.div key={c.candidate_id} layout draggable
                      onDragStart={() => setDragging(c.candidate_id)}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      className={"glass-panel rounded-xl p-3 cursor-grab active:cursor-grabbing transition-transform " +
                        (dragging === c.candidate_id ? "opacity-60 scale-[0.98]" : "")}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-fog flex items-center justify-center text-[10px]">
                          {c.name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "??"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] truncate">{c.name}</div>
                          <div className="text-[10.5px] text-muted-foreground truncate">{c.headline}</div>
                        </div>
                        <div className="font-serif text-base">{c.score ?? "—"}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
