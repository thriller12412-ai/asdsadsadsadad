import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyInterviews } from "@/lib/interviews.functions";

export const Route = createFileRoute("/candidate/history")({
  head: () => ({
    meta: [
      { title: "History — Hirely.ai Candidate" },
      { name: "description", content: "A quiet timeline of every interview you've taken." },
    ],
  }),
  component: HistoryPage,
});

type Row = {
  id: string;
  role_target: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  interview_results: Array<{ overall_score: number; summary: string }> | null;
};

function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const listFn = useServerFn(listMyInterviews);

  useEffect(() => {
    listFn().then((r) => setRows((r ?? []) as any)).catch(() => {});
  }, [listFn]);

  return (
    <main className="pt-28 pb-24 px-6 md:px-10">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center gap-3 mb-14">
          <span className="eyebrow">History</span>
          <span className="hairline flex-1" />
          <span className="text-[11px] tracking-wide text-muted-foreground">{rows.length} sessions</span>
        </div>

        <h1 className="display-xl text-[10vw] md:text-[6.5vw] leading-[0.95]">
          Every rehearsal, <span className="text-muted-foreground/80">remembered.</span>
        </h1>

        {rows.length === 0 ? (
          <div className="mt-32 text-center text-muted-foreground">
            No interviews yet. <Link to="/candidate/prepare" search={{ resumeId: undefined }} className="text-ink underline underline-offset-4">Start your first →</Link>
          </div>
        ) : (
          <div className="mt-24 divide-y divide-black/10">
            {rows.map((r) => {
              const score = r.interview_results?.[0]?.overall_score;
              const summary = r.interview_results?.[0]?.summary;
              const active = hover === r.id;
              return (
                <div
                  key={r.id}
                  onMouseEnter={() => setHover(r.id)}
                  onMouseLeave={() => setHover(null)}
                  className="grid grid-cols-12 items-center py-8 gap-6 transition-all"
                  style={{ opacity: hover === null || active ? 1 : 0.45 }}
                >
                  <div className="col-span-3 md:col-span-2 text-[12px] tracking-wide text-muted-foreground">
                    {new Date(r.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div className="col-span-6 md:col-span-6 text-xl md:text-2xl tracking-tight">{r.role_target || "Interview"}</div>
                  <div className="col-span-2 text-[11px] tracking-[.22em] uppercase text-muted-foreground hidden md:block">{r.status}</div>
                  <div className="col-span-3 md:col-span-2 text-right font-serif text-3xl">{score ?? "—"}</div>

                  {summary && (
                    <div className="col-span-12 overflow-hidden transition-all duration-500"
                      style={{ maxHeight: active ? 120 : 0, opacity: active ? 1 : 0 }}>
                      <div className="pt-4 text-sm text-muted-foreground">{summary}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-24 flex items-center justify-between border-t border-black/10 pt-8">
          <div className="text-sm text-muted-foreground">Ready for another round?</div>
          <Link to="/candidate/prepare" search={{ resumeId: undefined }} className="px-6 py-3 rounded-full bg-ink text-background text-[13px] tracking-wide hover:bg-black/85 transition-colors">
            Start a new interview →
          </Link>

        </div>
      </div>
    </main>
  );
}
