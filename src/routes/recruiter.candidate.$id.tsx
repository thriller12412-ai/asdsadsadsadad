import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRecruiterCandidate, setCandidateStatus, setCandidateNotes } from "@/lib/recruiter-candidates.functions";

export const Route = createFileRoute("/recruiter/candidate/$id")({
  head: () => ({
    meta: [
      { title: "Candidate — Hirely.ai Recruiter" },
      { name: "description", content: "AI-generated candidate profile." },
    ],
  }),
  component: CandidateDetail,
});

type Data = NonNullable<Awaited<ReturnType<typeof getRecruiterCandidate>>>;

function CandidateDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const getFn = useServerFn(getRecruiterCandidate);
  const statusFn = useServerFn(setCandidateStatus);
  const notesFn = useServerFn(setCandidateNotes);
  const [d, setD] = useState<Data | null>(null);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getFn({ data: { id } }).then(r => {
      if (!r) { setErr("Not found"); return; }
      setD(r as Data);
      setNotes(r.notes ?? "");
    }).catch(e => setErr(e.message));
  }, [id, getFn]);

  async function setStatus(status: "shortlisted" | "needs_review" | "rejected") {
    if (!d) return;
    setD({ ...d, status });
    try { await statusFn({ data: { resumeId: d.resume_id, status } }); } catch (e: any) { setErr(e.message); }
  }

  async function saveNotes() {
    if (!d) return;
    try {
      await notesFn({ data: { resumeId: d.resume_id, notes } });
      setSaved(true); setTimeout(() => setSaved(false), 1400);
    } catch (e: any) { setErr(e.message); }
  }

  if (err) return <div className="pt-32 px-6 text-red-600">{err}</div>;
  if (!d) return <div className="pt-32 px-6 text-muted-foreground">Loading…</div>;

  const s = d.structured ?? {};
  const raw = d.analysis?.raw ?? {};
  const skills = s.skills ?? {};
  const score = d.analysis?.overall_score ?? 0;
  const verdict = score >= 90 ? "Outstanding" : score >= 80 ? "Excellent" : score >= 70 ? "Strong" : score >= 55 ? "Promising" : "Review";

  return (
    <main className="pt-24 pb-24 px-6 min-h-screen">
      <section className="max-w-[1300px] mx-auto">
        <button onClick={() => nav({ to: "/recruiter/candidates" })} className="text-[12px] text-muted-foreground hover:text-ink transition-colors">← Back to pool</button>

        <div className="mt-8 grid grid-cols-12 gap-10">
          {/* Header + Content */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-12 lg:col-span-8">
            <div className="eyebrow mb-3">{s.headline || "Candidate"}</div>
            <h1 className="font-serif italic text-[6vw] md:text-[4.5vw] leading-[0.95] tracking-tight">{s.name ?? d.file_name}</h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              {s.email && <Contact label="Email" value={s.email} href={`mailto:${s.email}`} />}
              {s.phone && <Contact label="Phone" value={s.phone} />}
              {s.location && <Contact label="Location" value={s.location} />}
              {s.linkedin && <Contact label="LinkedIn" value="Open" href={s.linkedin} />}
              {s.github && <Contact label="GitHub" value="Open" href={s.github} />}
              {s.portfolio && <Contact label="Portfolio" value="Open" href={s.portfolio} />}
            </div>

            <div className="hairline my-10" />

            {d.analysis?.summary && (
              <Block title="AI summary">
                <p className="text-[16px] leading-relaxed text-ink/85">{d.analysis.summary}</p>
              </Block>
            )}

            {raw.ranking_explanation && (
              <Block title="Why this score">
                <p className="text-[15px] leading-relaxed text-ink/80">{raw.ranking_explanation}</p>
              </Block>
            )}

            {(d.analysis?.strengths ?? []).length > 0 && (
              <Block title="Strengths">
                <ul className="space-y-2 text-[14.5px]">
                  {(d.analysis!.strengths as string[]).map((v: string, i: number) => <li key={i} className="flex gap-3"><span className="text-muted-foreground">—</span>{v}</li>)}
                </ul>
              </Block>
            )}

            {(d.analysis?.gaps ?? []).length > 0 && (
              <Block title="Gaps">
                <ul className="space-y-2 text-[14.5px] text-muted-foreground">
                  {(d.analysis!.gaps as string[]).map((v: string, i: number) => <li key={i} className="flex gap-3"><span>—</span>{v}</li>)}
                </ul>
              </Block>
            )}

            {(s.experience ?? []).length > 0 && (
              <Block title="Experience">
                <ol className="relative pl-5 space-y-6">
                  <span className="absolute left-1 top-2 bottom-2 w-px bg-black/10" />
                  {s.experience.map((e: any, i: number) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[15px] top-2 w-2 h-2 rounded-full bg-ink" />
                      <div className="text-[15.5px]">{e.role} <span className="text-muted-foreground">· {e.company}</span></div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5">{e.period}{e.location ? ` · ${e.location}` : ""}</div>
                      {(e.bullets ?? []).length > 0 && (
                        <ul className="mt-2 space-y-1 text-[13.5px] text-ink/80">
                          {e.bullets.map((b: string, j: number) => <li key={j}>— {b}</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </Block>
            )}

            {(s.projects ?? []).length > 0 && (
              <Block title="Projects">
                <div className="grid md:grid-cols-2 gap-4">
                  {s.projects.map((p: any, i: number) => (
                    <div key={i} className="border border-black/10 rounded-2xl p-5">
                      <div className="text-[15px] font-medium">{p.name}</div>
                      {p.description && <div className="mt-2 text-[13px] text-ink/75">{p.description}</div>}
                      {p.impact && <div className="mt-2 text-[12px] italic text-muted-foreground">{p.impact}</div>}
                      {(p.tech ?? []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {p.tech.map((t: string) => <span key={t} className="text-[10.5px] px-2 py-0.5 rounded-full border border-black/10 text-muted-foreground">{t}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Block>
            )}

            {Object.keys(skills).length > 0 && (
              <Block title="Skills">
                <div className="space-y-3">
                  {Object.entries(skills).map(([k, arr]) => (
                    (arr as string[])?.length > 0 && (
                      <div key={k}>
                        <div className="text-[10.5px] tracking-[.24em] uppercase text-muted-foreground mb-1.5">{k}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(arr as string[]).map(x => <span key={x} className="text-[11.5px] px-2.5 py-1 rounded-full border border-black/10">{x}</span>)}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </Block>
            )}

            {(s.education ?? []).length > 0 && (
              <Block title="Education">
                <ul className="space-y-3">
                  {s.education.map((e: any, i: number) => (
                    <li key={i}>
                      <div className="text-[14.5px]">{e.degree} <span className="text-muted-foreground">· {e.school}</span></div>
                      <div className="text-[11.5px] text-muted-foreground">{e.period}</div>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {(s.certifications ?? []).length > 0 && (
              <Block title="Certifications">
                <ul className="space-y-1 text-[13.5px]">{s.certifications.map((c: string, i: number) => <li key={i}>— {c}</li>)}</ul>
              </Block>
            )}

            {(s.achievements ?? []).length > 0 && (
              <Block title="Achievements">
                <ul className="space-y-1 text-[13.5px]">{s.achievements.map((c: string, i: number) => <li key={i}>— {c}</li>)}</ul>
              </Block>
            )}
          </motion.div>

          {/* Sidebar */}
          <aside className="col-span-12 lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-6">
              <div className="glass-panel rounded-3xl p-8 text-center">
                <div className="font-serif text-[80px] leading-none tracking-tight">{score || "—"}</div>
                <div className="mt-2 text-[10.5px] tracking-[.28em] uppercase text-muted-foreground">{verdict}</div>
                {raw.hiring_recommendation && (
                  <div className="mt-4 inline-block px-3 py-1 rounded-full border border-black/10 text-[11px] tracking-wide">
                    {String(raw.hiring_recommendation).replace(/_/g, " ")}
                  </div>
                )}
                {raw.career_level && (
                  <div className="mt-3 text-[12px] text-muted-foreground">
                    {raw.career_level} · {raw.years_experience ?? "—"} yrs
                  </div>
                )}
              </div>

              <div className="glass-panel rounded-3xl p-6">
                <div className="eyebrow mb-3">Status</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <StatusBtn label="Shortlist" active={d.status === "shortlisted"} onClick={() => setStatus("shortlisted")} />
                  <StatusBtn label="Review" active={d.status === "needs_review"} onClick={() => setStatus("needs_review")} />
                  <StatusBtn label="Reject" active={d.status === "rejected"} onClick={() => setStatus("rejected")} />
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-6">
                <div className="eyebrow mb-3">AI breakdown</div>
                <div className="space-y-2.5">
                  <Meter label="ATS" v={d.analysis?.ats_score ?? 0} />
                  <Meter label="Clarity" v={d.analysis?.clarity ?? 0} />
                  <Meter label="Impact" v={d.analysis?.impact ?? 0} />
                  <Meter label="Technical" v={raw.technical ?? 0} />
                  <Meter label="Communication" v={raw.communication ?? 0} />
                  <Meter label="Leadership" v={raw.leadership ?? 0} />
                  <Meter label="Project quality" v={raw.project_quality ?? 0} />
                  <Meter label="Recruiter appeal" v={raw.recruiter_appeal ?? 0} />
                  <Meter label="Growth potential" v={raw.growth_potential ?? 0} />
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="eyebrow">Recruiter notes</div>
                  {saved && <span className="text-[10.5px] text-emerald-600">Saved</span>}
                </div>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes}
                  rows={6}
                  placeholder="Follow up next week. Ask about backend depth…"
                  className="w-full bg-transparent text-[13px] leading-relaxed outline-none resize-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="glass-panel rounded-3xl p-6">
                <div className="eyebrow mb-3">Contact</div>
                <div className="space-y-2 text-[13px]">
                  {s.email && <QuickAction label="Copy email" onClick={() => copy(s.email)} />}
                  {s.email && <QuickAction label="Email candidate" href={`mailto:${s.email}`} />}
                  {s.phone && <QuickAction label="Copy phone" onClick={() => copy(s.phone)} />}
                  {s.linkedin && <QuickAction label="Open LinkedIn" href={s.linkedin} />}
                  {s.github && <QuickAction label="Open GitHub" href={s.github} />}
                  {s.portfolio && <QuickAction label="Open portfolio" href={s.portfolio} />}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-10"><div className="eyebrow mb-4">{title}</div>{children}</section>;
}
function Contact({ label, value, href }: { label: string; value: string; href?: string }) {
  const inner = <><span className="text-[10px] tracking-[.24em] uppercase mr-1.5">{label}</span>{value}</>;
  return href ? <a href={href} target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">{inner}</a> : <span>{inner}</span>;
}
function Meter({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] mb-1">
        <span className="text-muted-foreground">{label}</span><span className="tabular-nums">{v || 0}</span>
      </div>
      <div className="h-[3px] rounded-full bg-black/[0.07] overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, v || 0)}%` }} transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full bg-ink" />
      </div>
    </div>
  );
}
function StatusBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={"py-2 rounded-full text-[11px] tracking-wide transition-colors " +
        (active ? "bg-ink text-background" : "border border-black/10 text-muted-foreground hover:text-ink")}>{label}</button>
  );
}
function QuickAction({ label, onClick, href }: { label: string; onClick?: () => void; href?: string }) {
  const cls = "block w-full text-left px-3 py-2 rounded-full border border-black/10 hover:border-black/30 transition-colors text-[12.5px]";
  return href ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{label} ↗</a> : <button onClick={onClick} className={cls}>{label}</button>;
}
function copy(s: string) { navigator.clipboard.writeText(s).catch(() => {}); }
