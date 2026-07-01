import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recruiterAnalytics } from "@/lib/recruiter.functions";

export const Route = createFileRoute("/recruiter/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Hirely.ai Recruiter" },
      { name: "description", content: "An editorial view of your real hiring funnel." },
    ],
  }),
  component: AnalyticsPage,
});

type Data = {
  funnel: Record<string, number>;
  trend: Array<{ week: string; count: number }>;
  totals: { resumes: number; interviews: number };
};

function AnalyticsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fn = useServerFn(recruiterAnalytics);

  useEffect(() => {
    fn().then((r) => setD(r as Data)).catch((e) => setError(e.message));
  }, [fn]);

  const FUNNEL = d ? Object.entries(d.funnel).map(([label, value]) => ({ label, value })) : [];
  const max = Math.max(1, ...FUNNEL.map((f) => f.value));

  return (
    <main className="pt-24 pb-16 px-6 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between mb-14">
          <div>
            <div className="eyebrow mb-3">Analytics</div>
            <h1 className="display-xl text-[5.5vw] leading-[0.95]">This quarter, at a glance.</h1>
          </div>
          {d && (
            <div className="flex items-end gap-14 pb-2">
              <Kpi n={String(d.totals.resumes)} label="Resumes" />
              <Kpi n={String(d.totals.interviews)} label="Interviews" />
              <Kpi n={String(d.funnel.Hired)} label="Hired · QTD" />
            </div>
          )}
        </div>

        {error && <div className="text-sm text-red-600 mb-6">{error}</div>}
        {!d && !error && <div className="text-sm text-muted-foreground">Loading…</div>}

        {d && (
          <>
            <section className="glass-panel rounded-2xl p-10">
              <div className="eyebrow mb-8">Hiring Funnel</div>
              <div className="space-y-6">
                {FUNNEL.map((f, i) => {
                  const pct = f.value / max;
                  return (
                    <div key={f.label} className="grid grid-cols-12 items-center gap-6">
                      <div className="col-span-3 text-[13px] text-muted-foreground">{f.label}</div>
                      <div className="col-span-8 h-[2px] bg-black/5 relative overflow-hidden">
                        <motion.span initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }}
                          transition={{ duration: 1.1, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute inset-y-0 left-0 bg-ink" />
                      </div>
                      <div className="col-span-1 text-right font-serif text-2xl">{f.value}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-6 glass-panel rounded-2xl p-10">
              <div className="flex items-baseline justify-between mb-8">
                <div className="eyebrow">Resume uploads · 12 weeks</div>
              </div>
              <TrendLine data={d.trend.map((t) => t.count)} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Kpi({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-serif text-5xl leading-none tracking-tight">{n}</div>
      <div className="mt-2 text-[11px] tracking-[.22em] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function TrendLine({ data }: { data: number[] }) {
  const w = 1000, h = 220, pad = 20;
  const max = Math.max(1, ...data), min = Math.min(0, ...data);
  const range = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = pts.length > 0 ? `${d} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z` : "";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]">
      <defs>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(200,170,110,.28)" />
          <stop offset="100%" stopColor="rgba(200,170,110,0)" />
        </linearGradient>
      </defs>
      {area && <motion.path d={area} fill="url(#area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} />}
      <motion.path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} />
      {pts.map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r={2.5} className="fill-ink"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 + i * 0.03 }} />
      ))}
    </svg>
  );
}
