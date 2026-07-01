import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listRecruiterCandidates, setCandidateStatus, deleteRecruiterCandidate } from "@/lib/recruiter-candidates.functions";

export const Route = createFileRoute("/recruiter/candidates")({
  head: () => ({
    meta: [
      { title: "Candidates — Hirely.ai Recruiter" },
      { name: "description", content: "Every uploaded candidate — ranked, filtered and shortlisted." },
    ],
  }),
  component: CandidatesPage,
});

type Row = Awaited<ReturnType<typeof listRecruiterCandidates>>[number];
type Filter = "all" | "shortlisted" | "needs_review" | "rejected";

function CandidatesPage() {
  const listFn = useServerFn(listRecruiterCandidates);
  const statusFn = useServerFn(setCandidateStatus);
  const delFn = useServerFn(deleteRecruiterCandidate);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [err, setErr] = useState<string | null>(null);

  const load = () => listFn().then(r => { setRows(r as Row[]); setLoading(false); }).catch(e => { setErr(e.message); setLoading(false); });
  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
    const scoped = filter === "all" ? sorted : sorted.filter(r => r.status === filter);
    if (!q.trim()) return scoped;
    const needle = q.toLowerCase();
    return scoped.filter(r => {
      const skills = flatSkills(r.structured?.skills);
      return `${r.name} ${r.headline} ${r.summary} ${skills.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [rows, q, filter]);

  async function updateStatus(id: string, status: "shortlisted" | "needs_review" | "rejected") {
    setRows(prev => prev.map(r => r.resume_id === id ? { ...r, status } : r));
    try { await statusFn({ data: { resumeId: id, status } }); } catch (e: any) { setErr(e.message); }
  }
  async function del(id: string) {
    if (!confirm("Delete this candidate profile?")) return;
    setRows(prev => prev.filter(r => r.resume_id !== id));
    try { await delFn({ data: { resumeId: id } }); } catch (e: any) { setErr(e.message); }
  }

  const counts = {
    all: rows.length,
    shortlisted: rows.filter(r => r.status === "shortlisted").length,
    needs_review: rows.filter(r => r.status === "needs_review").length,
    rejected: rows.filter(r => r.status === "rejected").length,
  };

  return (
    <main className="pt-28 pb-24 px-6 min-h-screen">
      <section className="max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="eyebrow mb-3">Pool · {rows.length}</div>
            <h1 className="font-serif italic text-[6vw] md:text-[4.5vw] leading-[0.95] tracking-tight">All candidates.</h1>
          </div>
          <Link to="/recruiter/upload" className="px-5 py-2.5 rounded-full bg-ink text-background text-[12px]">Upload more</Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Find React developers · startup experience · ML engineers…"
            className="flex-1 min-w-[280px] bg-transparent border border-black/10 rounded-full px-5 py-3 text-[14px] outline-none focus:border-black/40 transition-colors"
          />
          <div className="flex items-center gap-1 glass-panel rounded-full p-1">
            {(["all", "shortlisted", "needs_review", "rejected"] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={"px-3.5 py-1.5 rounded-full text-[11.5px] tracking-wide transition-colors " +
                  (filter === f ? "bg-ink text-background" : "text-muted-foreground hover:text-ink")}>
                {LABEL[f]} <span className="opacity-60 ml-1">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {err && <div className="mt-6 text-sm text-red-600">{err}</div>}

        <div className="mt-10">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading pool…</div>
          ) : filtered.length === 0 ? (
            <div className="border border-dashed border-black/10 rounded-2xl px-8 py-16 text-center text-muted-foreground">
              No candidates match this view.
            </div>
          ) : (
            <ol className="divide-y divide-black/5 border-t border-b border-black/5">
              <AnimatePresence initial={false}>
                {filtered.map((r, i) => (
                  <motion.li key={r.resume_id}
                    layout
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  >
                    <div className="grid grid-cols-12 items-center py-5 gap-4">
                      <div className="col-span-1 font-serif text-2xl text-muted-foreground">#{i + 1}</div>
                      <Link to="/recruiter/candidate/$id" params={{ id: r.resume_id }} className="col-span-5 min-w-0 group">
                        <div className="text-[15.5px] tracking-tight group-hover:underline underline-offset-4">{r.name}</div>
                        <div className="text-[12px] text-muted-foreground truncate mt-0.5">{r.headline || r.file_name}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {flatSkills(r.structured?.skills).slice(0, 6).map(s => (
                            <span key={s} className="text-[10.5px] px-2 py-0.5 rounded-full border border-black/10 text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      </Link>
                      <div className="col-span-3 text-[12.5px] text-muted-foreground line-clamp-3">{r.summary}</div>
                      <div className="col-span-1 text-right">
                        <div className="font-serif text-3xl leading-none">{r.overall_score || "—"}</div>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <ActionBtn onClick={() => updateStatus(r.resume_id, "shortlisted")} active={r.status === "shortlisted"} label="★" title="Shortlist" />
                        <ActionBtn onClick={() => updateStatus(r.resume_id, "needs_review")} active={r.status === "needs_review"} label="◐" title="Needs review" />
                        <ActionBtn onClick={() => updateStatus(r.resume_id, "rejected")} active={r.status === "rejected"} label="✕" title="Reject" />
                        <button onClick={() => del(r.resume_id)} title="Delete"
                          className="w-8 h-8 rounded-full text-muted-foreground hover:text-red-600 transition-colors text-[13px]">🗑</button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
        </div>
      </section>
    </main>
  );
}

const LABEL: Record<Filter, string> = { all: "All", shortlisted: "Shortlist", needs_review: "Review", rejected: "Rejected" };

function ActionBtn({ onClick, active, label, title }: { onClick: () => void; active: boolean; label: string; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className={"w-8 h-8 rounded-full text-[13px] transition-colors " +
        (active ? "bg-ink text-background" : "text-muted-foreground hover:text-ink hover:bg-black/[0.04]")}>{label}</button>
  );
}

function flatSkills(skills: any): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  return Object.values(skills).flat().filter(Boolean) as string[];
}
