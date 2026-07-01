import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listRecruiterCandidates } from "@/lib/recruiter-candidates.functions";

export const Route = createFileRoute("/recruiter/")({
  head: () => ({
    meta: [
      { title: "Overview — Hirely.ai Recruiter" },
      { name: "description", content: "Your best candidates, ranked and explained by AI." },
    ],
  }),
  component: Overview,
});

type Row = Awaited<ReturnType<typeof listRecruiterCandidates>>[number];

function Overview() {
  const listFn = useServerFn(listRecruiterCandidates);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listFn().then(r => { setRows(r as Row[]); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [listFn]);

  const stats = useMemo(() => {
    const total = rows.length;
    const short = rows.filter(r => r.status === "shortlisted").length;
    const rev = rows.filter(r => r.status === "needs_review").length;
    const rej = rows.filter(r => r.status === "rejected").length;
    const avg = total ? Math.round(rows.reduce((a, r) => a + (r.overall_score || 0), 0) / total) : 0;
    return { total, short, rev, rej, avg };
  }, [rows]);

  const top = useMemo(() =>
    [...rows].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0)).slice(0, 6),
    [rows]
  );

  return (
    <main className="pt-28 pb-24 px-6 min-h-screen">
      <section className="max-w-[1400px] mx-auto">
        <div className="eyebrow mb-4">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
        <h1 className="font-serif italic text-[8vw] md:text-[6.5vw] leading-[0.92] tracking-tight text-ink">Your best<br/>candidates.</h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl">Upload resumes. Hirely.ai builds every profile, ranks the pool, and explains why.</p>

        {err && <div className="mt-6 text-sm text-red-600">{err}</div>}

        <div className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-x-10 gap-y-8">
          <Stat n={stats.total} label="Total" />
          <Stat n={stats.short} label="Shortlisted" accent />
          <Stat n={stats.rev} label="Needs review" />
          <Stat n={stats.rej} label="Rejected" muted />
          <Stat n={stats.avg} label="Avg AI score" suffix={stats.total ? "" : "—"} />
        </div>

        <div className="hairline my-16" />

        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="eyebrow mb-2">Ranked pool</div>
            <h2 className="text-3xl font-medium tracking-tight">Top of the stack</h2>
          </div>
          <div className="flex gap-2">
            <Link to="/recruiter/upload" className="px-5 py-2.5 rounded-full bg-ink text-background text-[12px] tracking-wide hover:bg-black/85 transition-colors">Upload resumes</Link>
            <Link to="/recruiter/candidates" className="px-5 py-2.5 rounded-full border border-black/10 text-[12px] tracking-wide hover:border-black/30 transition-colors">View all</Link>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading pool…</div>
        ) : top.length === 0 ? (
          <EmptyState />
        ) : (
          <ol className="divide-y divide-black/5 border-t border-b border-black/5">
            {top.map((r, i) => (
              <TopRow key={r.resume_id} rank={i + 1} r={r} />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function Stat({ n, label, accent, muted, suffix }: { n: number | string; label: string; accent?: boolean; muted?: boolean; suffix?: string }) {
  return (
    <div>
      <div className={"font-serif leading-none tracking-tight text-6xl " + (accent ? "text-ink" : muted ? "text-muted-foreground" : "text-ink")}>
        {suffix || n}
      </div>
      <div className="mt-3 text-[10.5px] tracking-[.24em] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function TopRow({ rank, r }: { rank: number; r: Row }) {
  const verdict = r.overall_score >= 90 ? "Outstanding" : r.overall_score >= 80 ? "Excellent" : r.overall_score >= 70 ? "Strong" : r.overall_score >= 55 ? "Promising" : "Review";
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03 }}
    >
      <Link to="/recruiter/candidate/$id" params={{ id: r.resume_id }}
        className="group grid grid-cols-12 items-center py-6 gap-6 hover:bg-black/[0.02] transition-colors -mx-4 px-4 rounded-xl">
        <div className="col-span-1 font-serif text-3xl text-muted-foreground group-hover:text-ink transition-colors">#{rank}</div>
        <div className="col-span-5">
          <div className="text-[17px] tracking-tight">{r.name}</div>
          <div className="text-[12.5px] text-muted-foreground mt-0.5 truncate">{r.headline || r.file_name}</div>
        </div>
        <div className="col-span-4 text-[12.5px] text-muted-foreground line-clamp-2">{r.summary || "AI analysis pending"}</div>
        <div className="col-span-2 text-right">
          <div className="font-serif text-4xl leading-none">{r.overall_score || "—"}</div>
          <div className="text-[9.5px] tracking-[.22em] uppercase text-muted-foreground mt-1.5">{verdict}</div>
        </div>
      </Link>
    </motion.li>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-black/15 rounded-3xl px-10 py-20 text-center">
      <div className="font-serif italic text-4xl text-ink mb-3">No candidates yet.</div>
      <p className="text-muted-foreground max-w-md mx-auto">Drop in your first resume — a single file or a whole folder. Hirely.ai builds every profile automatically.</p>
      <Link to="/recruiter/upload" className="inline-block mt-8 px-6 py-3 rounded-full bg-ink text-background text-[13px]">Upload resumes</Link>
    </div>
  );
}
