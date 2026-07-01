import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { listMyResumes } from "@/lib/resumes.functions";
import { savePrep } from "@/lib/preps.functions";

export const Route = createFileRoute("/candidate/prepare")({
  head: () => ({
    meta: [
      { title: "Prepare — Hirely.ai Candidate" },
      { name: "description", content: "Pick your target role and mode. Optionally add a job description for a tailored interview." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    resumeId: typeof s.resumeId === "string" ? s.resumeId : undefined,
  }),
  component: PreparePage,
});

const ROLES = [
  "Frontend Developer", "Backend Developer", "Full-Stack Engineer",
  "AI Engineer", "Machine Learning Engineer", "Data Scientist",
  "iOS Engineer", "Android Engineer", "Software Engineer",
  "UI/UX Designer", "Product Manager", "DevOps Engineer",
];
const LEVELS = ["Intern", "Junior", "Mid", "Senior", "Staff", "Principal"] as const;
const COMPANIES = ["Startup", "Mid-size", "Enterprise", "Remote", "Hybrid", "Any"] as const;
const MODES = ["HR", "Technical", "Behavioral", "Mixed", "Mock Final"] as const;

function PreparePage() {
  const { resumeId: initialResumeId } = useSearch({ from: "/candidate/prepare" });
  const nav = useNavigate();
  const listFn = useServerFn(listMyResumes);
  const saveFn = useServerFn(savePrep);

  const [resumes, setResumes] = useState<Array<{ id: string; file_name: string }>>([]);
  const [resumeId, setResumeId] = useState<string | undefined>(initialResumeId);
  const [role, setRole] = useState<string>("Frontend Developer");
  const [customRole, setCustomRole] = useState<string>("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Mid");
  const [company, setCompany] = useState<(typeof COMPANIES)[number]>("Any");
  const [mode, setMode] = useState<(typeof MODES)[number]>("Mixed");
  const [jdText, setJdText] = useState<string>("");
  const [showJd, setShowJd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jdResult, setJdResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFn().then(rs => {
      const opts = (rs ?? []).map(r => ({ id: r.id, file_name: r.file_name }));
      setResumes(opts);
      if (!resumeId && opts[0]) setResumeId(opts[0].id);
    }).catch(() => {});
  }, [listFn, resumeId]);

  async function startInterview() {
    setSaving(true);
    setError(null);
    try {
      const roleTarget = customRole.trim() || role;
      const res = await saveFn({
        data: {
          resumeId, roleTarget,
          experienceLevel: level, companyType: company, mode,
          jdText: jdText.trim() || undefined,
        },
      });
      if (res.jdAnalysis && !jdResult) {
        setJdResult(res.jdAnalysis);
        setSaving(false);
        // Store prep id in state via URL for the "Continue" button
        (window as any).__prepId = res.prepId;
        return;
      }
      nav({ to: "/candidate/interview", search: { prepId: res.prepId } as any });
    } catch (e: any) {
      setError(e?.message ?? "Failed to prepare");
      setSaving(false);
    }
  }

  return (
    <main className="pt-40 pb-24 px-6 md:px-10">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center gap-3 mb-12">
          <span className="eyebrow">Prepare</span>
          <span className="hairline flex-1" />
          <Link to="/candidate" className="text-[12px] tracking-wide text-muted-foreground hover:text-ink">← Studio</Link>
        </div>

        <h1 className="display-xl text-[11vw] md:text-[7vw] leading-[0.95]">
          What role are you<br />
          <span className="text-muted-foreground/70">preparing for?</span>
        </h1>

        <AnimatePresence mode="wait">
          {!jdResult ? (
            <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5 }} className="mt-20 grid grid-cols-12 gap-y-16 md:gap-x-16">
              <section className="col-span-12 md:col-span-7">
                <div className="eyebrow mb-5">Target role</div>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(r => (
                    <button
                      key={r}
                      onClick={() => { setRole(r); setCustomRole(""); }}
                      className={"px-4 py-2 rounded-full border text-[13px] transition-colors " + ((role === r && !customRole) ? "border-ink bg-ink text-background" : "border-black/15 hover:border-black/40")}
                    >{r}</button>
                  ))}
                </div>
                <input
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Or type your own…"
                  className="mt-5 w-full bg-transparent border-b border-black/15 py-3 outline-none text-lg focus:border-ink transition-colors"
                />

                <div className="eyebrow mt-12 mb-5">Resume context</div>
                <select
                  value={resumeId ?? ""}
                  onChange={(e) => setResumeId(e.target.value || undefined)}
                  className="w-full bg-transparent border-b border-black/15 py-3 outline-none text-base focus:border-ink transition-colors"
                >
                  <option value="">No resume — general questions</option>
                  {resumes.map(r => <option key={r.id} value={r.id}>{r.file_name}</option>)}
                </select>
              </section>

              <aside className="col-span-12 md:col-span-5 space-y-10">
                <div>
                  <div className="eyebrow mb-4">Experience level</div>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map(l => (
                      <button key={l} onClick={() => setLevel(l)}
                        className={"px-3 py-1.5 rounded-full text-[12px] border transition-colors " + (level === l ? "border-ink bg-ink text-background" : "border-black/15 hover:border-black/40")}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-4">Preferred company</div>
                  <div className="flex flex-wrap gap-2">
                    {COMPANIES.map(c => (
                      <button key={c} onClick={() => setCompany(c)}
                        className={"px-3 py-1.5 rounded-full text-[12px] border transition-colors " + (company === c ? "border-ink bg-ink text-background" : "border-black/15 hover:border-black/40")}>{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-4">Interview mode</div>
                  <div className="flex flex-wrap gap-2">
                    {MODES.map(m => (
                      <button key={m} onClick={() => setMode(m)}
                        className={"px-3 py-1.5 rounded-full text-[12px] border transition-colors " + (mode === m ? "border-ink bg-ink text-background" : "border-black/15 hover:border-black/40")}>{m}</button>
                    ))}
                  </div>
                </div>
              </aside>

              <section className="col-span-12">
                <div className="flex items-center justify-between mb-4">
                  <div className="eyebrow">Job description <span className="opacity-60 normal-case tracking-normal ml-2">(optional)</span></div>
                  <button onClick={() => setShowJd(v => !v)} className="text-[12px] text-muted-foreground hover:text-ink transition-colors">{showJd ? "Hide" : "Add JD"}</button>
                </div>
                <AnimatePresence>
                  {showJd && (
                    <motion.textarea
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 240 }} exit={{ opacity: 0, height: 0 }}
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the job description here. We'll compare it against your resume and shape the interview around the highest-leverage focus areas."
                      className="w-full glass-panel rounded-2xl p-5 outline-none text-[14px] leading-relaxed resize-none"
                    />
                  )}
                </AnimatePresence>
              </section>

              {error && <div className="col-span-12 text-sm text-red-600">{error}</div>}

              <div className="col-span-12 flex items-center justify-between border-t border-black/10 pt-8">
                <Link to="/candidate" className="text-[13px] text-muted-foreground hover:text-ink">← Back</Link>
                <button
                  onClick={startInterview}
                  disabled={saving}
                  className="px-7 py-3 rounded-full bg-ink text-background text-[13px] tracking-wide hover:bg-black/85 transition-colors disabled:opacity-50"
                >
                  {saving ? (showJd && jdText.trim() ? "Analyzing JD…" : "Preparing…") : "Continue →"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="jd" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-20">
              <div className="flex items-end gap-8 border-b border-black/10 pb-8">
                <div className="font-serif text-[18vw] md:text-[12vw] leading-[0.8]">{Math.round(Number(jdResult.match_percent ?? 0))}%</div>
                <div className="pb-4">
                  <div className="eyebrow mb-2">Resume ↔ JD match</div>
                  <div className="text-xl text-muted-foreground max-w-md">Interview will focus on the highest-leverage gaps below.</div>
                </div>
              </div>

              <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-12">
                <JdList title="Matching skills" items={jdResult.matching_skills ?? []} />
                <JdList title="Missing skills" items={jdResult.missing_skills ?? []} muted />
                <JdList title="Missing keywords" items={jdResult.missing_keywords ?? []} muted />
                <JdList title="Priority improvements" items={jdResult.priority_improvements ?? []} />
                <div className="md:col-span-2">
                  <div className="eyebrow mb-4">Interview focus areas</div>
                  <div className="flex flex-wrap gap-2">
                    {(jdResult.interview_focus_areas ?? []).map((f: string) => (
                      <span key={f} className="px-3 py-1.5 rounded-full text-[13px] bg-ink text-background">{f}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-16 flex items-center justify-between border-t border-black/10 pt-8">
                <button onClick={() => setJdResult(null)} className="text-[13px] text-muted-foreground hover:text-ink">← Adjust</button>
                <button
                  onClick={() => nav({ to: "/candidate/interview", search: { prepId: (window as any).__prepId } as any })}
                  className="px-7 py-3 rounded-full bg-ink text-background text-[13px] tracking-wide hover:bg-black/85"
                >
                  Start interview →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function JdList({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div>
      <div className="eyebrow mb-4">{title}</div>
      {items.length === 0 ? <div className="text-sm text-muted-foreground">—</div> : (
        <ul className={"space-y-2 " + (muted ? "text-muted-foreground" : "")}>
          {items.map((s, i) => <li key={i} className="flex gap-3"><span className="mt-2.5 w-3 h-px bg-current opacity-40" /><span>{s}</span></li>)}
        </ul>
      )}
    </div>
  );
}
