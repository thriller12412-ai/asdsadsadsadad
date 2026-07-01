import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { uploadAndAnalyzeResume, listMyResumes } from "@/lib/resumes.functions";
import { getMyProfile } from "@/lib/auth.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/candidate/")({
  head: () => ({
    meta: [
      { title: "Candidate Studio — Hirely.ai" },
      { name: "description", content: "Upload your resume, get real AI analysis, and prepare for interviews." },
    ],
  }),
  component: CandidateStudio,
});

type Phase = "welcome" | "analyzing" | "results";
type Analysis = {
  id: string;
  resumeId: string;
  overall_score: number;
  ats_score: number;
  clarity: number;
  impact: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  roadmap: Array<{ area: string; suggestion: string }>;
  raw?: any;
  structured?: any;
};


function CandidateStudio() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadFn = useServerFn(uploadAndAnalyzeResume);
  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listMyResumes);

  useEffect(() => {
    if (!user) return;
    profileFn().then((p) => setDisplayName(p.profile?.name ?? (p.email ?? "").split("@")[0] ?? "there")).catch(() => {});
    // If they already have a resume, show its latest analysis
    listFn().then((rs) => {
      const latest = rs?.[0];
      if (latest && latest.resume_analyses?.[0]) {
        const a = latest.resume_analyses[0] as any;
        setAnalysis({
          id: latest.id,
          resumeId: latest.id,
          overall_score: a.overall_score,
          ats_score: a.ats_score,
          clarity: a.clarity,
          impact: a.overall_score,
          summary: a.summary,
          strengths: a.strengths ?? [],
          gaps: a.gaps ?? [],
          roadmap: a.roadmap ?? [],
          raw: a.raw ?? null,
          structured: latest.structured ?? null,
        });
        setFileName(latest.file_name);
      }
    }).catch(() => {});
  }, [user, profileFn, listFn]);


  const onFile = async (f: File | null) => {
    if (!f) return;
    setError(null);
    setFileName(f.name);
    setPhase("analyzing");
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const res = await uploadFn({
        data: { fileName: f.name, mimeType: f.type || "application/octet-stream", contentBase64: b64 },
      });
      const a = res.analysis as any;
      setAnalysis({
        id: res.resumeId,
        resumeId: res.resumeId,
        overall_score: a.overall_score,
        ats_score: a.ats_score,
        clarity: a.clarity,
        impact: a.impact ?? a.overall_score,
        summary: a.summary,
        strengths: a.strengths ?? [],
        gaps: a.gaps ?? [],
        roadmap: a.roadmap ?? [],
        raw: a.raw ?? null,
        structured: res.structured ?? null,
      });
      setPhase("results");
    } catch (e: any) {
      setError(e?.message ?? "Analysis failed");
      setPhase("welcome");
    }
  };


  return (
    <main className="relative min-h-screen pt-28 pb-24 px-6 md:px-10">
      <AnimatePresence mode="wait">
        {phase === "welcome" && (
          <WelcomeStage
            key="w"
            name={displayName}
            error={error}
            onPickFile={() => inputRef.current?.click()}
            onDrop={onFile}
          />
        )}
        {phase === "analyzing" && <AnalyzingStage key="a" fileName={fileName} />}
        {phase === "results" && analysis && (
          <ResultsStage key="r" fileName={fileName} analysis={analysis} onReset={() => { setPhase("welcome"); setAnalysis(null); setFileName(null); }} />
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </main>
  );
}

function WelcomeStage({ name, error, onPickFile, onDrop }: { name: string; error: string | null; onPickFile: () => void; onDrop: (f: File) => void }) {
  const [hover, setHover] = useState(false);
  const [drag, setDrag] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-[1200px]"
    >
      <div className="flex items-center gap-3 mb-14">
        <span className="eyebrow">Studio</span>
        <span className="hairline flex-1" />
        <span className="text-[11px] tracking-wide text-muted-foreground">Session · {new Date().toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span>
      </div>

      <h1 className="display-xl text-[13vw] md:text-[9.5vw] leading-[0.9]">
        Welcome back,
        <br />
        <span className="text-muted-foreground/80">{name || "there"}.</span>
      </h1>

      <p className="mt-10 text-xl md:text-2xl text-muted-foreground max-w-2xl">
        Ready for your next interview?
      </p>

      {error && <div className="mt-6 text-sm text-red-600">{error}</div>}

      <div className="mt-24 md:mt-32 flex justify-center">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files?.[0]; if (f) onDrop(f);
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={onPickFile}
          className="group relative w-full max-w-[720px] cursor-pointer"
        >
          <div
            className="absolute -inset-10 rounded-[40px] transition-opacity duration-700 pointer-events-none"
            style={{
              background: "radial-gradient(60% 60% at 50% 50%, rgba(220,200,160,0.35), transparent 70%)",
              opacity: hover || drag ? 1 : 0.35,
            }}
          />
          <div className="glass-panel relative rounded-[28px] px-10 py-16 md:py-20 text-center overflow-hidden transition-transform duration-700"
            style={{ transform: hover || drag ? "translateY(-2px) scale(1.005)" : "none" }}>
            <div className="eyebrow mb-6">Resume</div>
            <div className="text-4xl md:text-5xl tracking-tight font-medium">Drop your resume</div>
            <div className="my-5 text-muted-foreground text-sm">or</div>
            <button type="button" className="text-[13px] tracking-wide px-5 py-2.5 rounded-full border border-black/10 hover:border-black/30 transition-colors">
              Choose file
            </button>
            <div className="mt-8 text-[11px] tracking-widest uppercase text-muted-foreground">
              PDF · DOCX · TXT · Image
            </div>
          </div>
        </div>
      </div>

      <div className="mt-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[12px] tracking-wide text-muted-foreground">
        <Link to="/candidate/prepare" search={{ resumeId: undefined }} className="hover:text-ink transition-colors">Skip to interview →</Link>
        <Link to="/candidate/history" className="hover:text-ink transition-colors">View past sessions</Link>
        <Link to="/candidate/profile" className="hover:text-ink transition-colors">Profile</Link>
      </div>
    </motion.section>
  );
}

const READ_STEPS = ["Uploading", "Extracting text", "Understanding with Groq", "Scoring & embedding"];

function AnalyzingStage({ fileName }: { fileName: string | null }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, READ_STEPS.length - 1)), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="relative mx-auto max-w-[1200px] min-h-[80vh] flex items-center justify-center"
    >
      <div className="relative w-full flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotateX: 20 }}
          animate={{ scale: 1, opacity: 1, rotateX: 4 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="paper-card relative w-[280px] h-[380px] rounded-[10px] p-6"
          style={{ transform: "perspective(1400px) rotateY(-6deg) rotateX(4deg)", animation: "float-tilt 6s ease-in-out infinite" }}
        >
          <div className="text-[10px] tracking-[.2em] uppercase text-muted-foreground">Resume</div>
          <div className="mt-3 text-lg font-medium truncate">{fileName ?? "resume.pdf"}</div>
          <div className="mt-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-1.5 rounded bg-black/8" style={{ width: `${60 + ((i * 13) % 40)}%` }} />
            ))}
          </div>
          <motion.div
            className="absolute left-0 right-0 h-8 pointer-events-none"
            style={{ background: "linear-gradient(180deg, transparent, rgba(200,170,110,.35), transparent)" }}
            initial={{ top: 0 }}
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6">
        {READ_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full transition-colors" style={{ background: i <= step ? "var(--ink)" : "rgba(0,0,0,.2)" }} />
            <span className={"text-[11px] tracking-wide " + (i <= step ? "text-ink" : "text-muted-foreground")}>{s}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function ResultsStage({ fileName, analysis, onReset }: { fileName: string | null; analysis: Analysis; onReset: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-[1200px]"
    >
      <div className="flex items-center gap-3 mb-14">
        <span className="eyebrow">Analysis</span>
        <span className="hairline flex-1" />
        <span className="text-[11px] tracking-wide text-muted-foreground truncate max-w-[240px]">{fileName ?? "resume.pdf"}</span>
      </div>

      <div className="grid grid-cols-12 gap-y-16 md:gap-x-10">
        <div className="col-span-12 md:col-span-7">
          <div className="eyebrow mb-6">Resume Score</div>
          <div className="flex items-end gap-6">
            <div className="font-serif text-[22vw] md:text-[16vw] leading-[0.8] font-normal tracking-tight">{analysis.overall_score}</div>
            <div className="pb-4 md:pb-8">
              <div className="text-lg md:text-xl">{analysis.overall_score >= 80 ? "Interview Ready." : analysis.overall_score >= 60 ? "Nearly there." : "Needs work."}</div>
              <div className="text-sm text-muted-foreground mt-1 max-w-md">{analysis.summary}</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-5 flex flex-col justify-end gap-6">
          <Metric label="ATS Match" value={`${analysis.ats_score}%`} note="Structured for parsers" />
          <Metric label="Clarity" value={`${analysis.clarity}`} note="Writing quality" />
          <Metric label="Impact" value={`${analysis.impact}`} note="Quantified outcomes" />
          {analysis.raw?.recruiter_appeal !== undefined && (
            <Metric label="Recruiter appeal" value={`${analysis.raw.recruiter_appeal}`} note={analysis.raw.salary_range ?? ""} />
          )}
        </div>
      </div>

      {analysis.raw && (
        <>
          <div className="h-16" />
          <div className="eyebrow mb-6">Deep metrics</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              ["Technical", analysis.raw.technical],
              ["Communication", analysis.raw.communication],
              ["Project quality", analysis.raw.project_quality],
              ["Leadership", analysis.raw.leadership],
              ["Formatting", analysis.raw.formatting],
              ["Grammar", analysis.raw.grammar],
              ["Recruiter appeal", analysis.raw.recruiter_appeal],
              ["Interview readiness", analysis.raw.interview_readiness],
            ].filter(([, v]) => v !== undefined && v !== null).map(([label, v]) => (
              <div key={label as string}>
                <div className="eyebrow mb-2">{label}</div>
                <div className="font-serif text-3xl">{Math.round(Number(v))}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="h-20" />

      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-12 md:col-span-6">
          <div className="eyebrow mb-6">Strengths</div>
          <ul className="space-y-4 text-lg">
            {analysis.strengths.map((s) => (
              <li key={s} className="flex gap-4">
                <span className="mt-3 w-6 h-px bg-black/40 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-12 md:col-span-6">
          <div className="eyebrow mb-6">Missing / To Strengthen</div>
          <ul className="space-y-4 text-lg text-muted-foreground">
            {analysis.gaps.map((s) => (
              <li key={s} className="flex gap-4">
                <span className="mt-3 w-6 h-px bg-champagne shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {analysis.raw && (
        <>
          <div className="h-16" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <TagList title="Missing keywords" items={analysis.raw.missing_keywords ?? []} />
            <TagList title="Missing tech skills" items={analysis.raw.missing_technical_skills ?? []} />
            <TagList title="Recommended roles" items={analysis.raw.recommended_roles ?? []} />
          </div>
        </>
      )}

      {analysis.structured && (
        <>
          <div className="h-20" />
          <ResumeBreakdown structured={analysis.structured} resumeId={analysis.resumeId} />
        </>
      )}

      {analysis.roadmap?.length > 0 && (
        <>
          <div className="h-20" />
          <div>
            <div className="eyebrow mb-6">Improvement Roadmap</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {analysis.roadmap.map((r, i) => (
                <div key={i} className="glass-panel rounded-2xl p-6">
                  <div className="eyebrow mb-2">{r.area}</div>
                  <div className="text-[14px] leading-relaxed">{r.suggestion}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="h-24" />

      <div className="flex flex-wrap items-center justify-between gap-6 border-t border-black/10 pt-8">
        <div>
          <div className="eyebrow mb-2">Next</div>
          <div className="text-2xl">Pick a role, then begin the interview.</div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onReset} className="text-[13px] text-muted-foreground hover:text-ink transition-colors">Re-upload</button>
          <Link
            to="/candidate/improve"
            search={{ resumeId: analysis.resumeId } as any}
            className="text-[13px] text-muted-foreground hover:text-ink transition-colors"
          >Improve resume →</Link>
          <Link
            to="/candidate/prepare"
            search={{ resumeId: analysis.resumeId } as any}
            className="group inline-flex items-center gap-3 px-6 py-3 rounded-full bg-ink text-background text-[13px] tracking-wide hover:bg-black/85 transition-colors"
          >
            Continue <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </div>

    </motion.section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div className="text-3xl tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{note}</div>
    </div>
  );
}

function TagList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="eyebrow mb-4">{title}</div>
      {items.length === 0 ? <div className="text-sm text-muted-foreground">—</div> : (
        <div className="flex flex-wrap gap-2">
          {items.map((s, i) => <span key={i} className="px-3 py-1 rounded-full text-[12px] border border-black/15">{s}</span>)}
        </div>
      )}
    </div>
  );
}

function ResumeBreakdown({ structured, resumeId }: { structured: any; resumeId: string }) {
  const [open, setOpen] = useState<string | null>("experience");
  const sections: Array<{ key: string; label: string; count: number }> = [
    { key: "experience", label: "Experience", count: (structured.experience ?? []).length },
    { key: "projects", label: "Projects", count: (structured.projects ?? []).length },
    { key: "education", label: "Education", count: (structured.education ?? []).length },
    { key: "skills", label: "Skills", count: (structured.skills ?? []).length },
    { key: "certifications", label: "Certifications", count: (structured.certifications ?? []).length },
    { key: "achievements", label: "Achievements", count: (structured.achievements ?? []).length },
  ];
  return (
    <div>
      <div className="eyebrow mb-6">Resume breakdown</div>
      <div className="divide-y divide-black/10 border-t border-b border-black/10">
        {sections.map(s => {
          const active = open === s.key;
          return (
            <div key={s.key}>
              <button onClick={() => setOpen(active ? null : s.key)} className="w-full flex items-center justify-between py-5 text-left">
                <div className="text-xl md:text-2xl tracking-tight">{s.label}</div>
                <div className="flex items-center gap-6">
                  <span className="text-[12px] text-muted-foreground">{s.count} item{s.count === 1 ? "" : "s"}</span>
                  <span className={"text-[18px] transition-transform " + (active ? "rotate-45" : "")}>+</span>
                </div>
              </button>
              {active && (
                <div className="pb-8 grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-9">
                    <SectionContent kind={s.key} data={structured[s.key]} />
                  </div>
                  <div className="md:col-span-3 flex md:justify-end">
                    <Link to="/candidate/improve" search={{ resumeId } as any}
                      className="self-start px-4 py-2 rounded-full text-[12px] border border-black/15 hover:border-black/40 transition-colors">
                      Improve {s.label.toLowerCase()} →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionContent({ kind, data }: { kind: string; data: any }) {
  if (!data || (Array.isArray(data) && data.length === 0)) return <div className="text-sm text-muted-foreground">Nothing extracted for this section.</div>;
  if (kind === "experience") {
    return <div className="space-y-6">{data.map((e: any, i: number) => (
      <div key={i}>
        <div className="text-[15px] font-medium">{e.title} <span className="text-muted-foreground font-normal">· {e.company}</span></div>
        <div className="text-[11px] tracking-[.22em] uppercase text-muted-foreground mt-0.5">{e.period}</div>
        <ul className="mt-3 space-y-1.5 text-[14px] text-muted-foreground">
          {(e.bullets ?? []).map((b: string, j: number) => <li key={j}>— {b}</li>)}
        </ul>
      </div>
    ))}</div>;
  }
  if (kind === "projects") {
    return <div className="space-y-6">{data.map((p: any, i: number) => (
      <div key={i}>
        <div className="text-[15px] font-medium">{p.name}</div>
        <div className="text-[14px] text-muted-foreground mt-1">{p.description}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(p.tech ?? []).map((t: string) => <span key={t} className="px-2 py-0.5 rounded-full text-[11px] border border-black/15">{t}</span>)}
        </div>
      </div>
    ))}</div>;
  }
  if (kind === "education") {
    return <div className="space-y-4">{data.map((e: any, i: number) => (
      <div key={i}>
        <div className="text-[15px] font-medium">{e.school}</div>
        <div className="text-[14px] text-muted-foreground">{e.degree} · {e.period}</div>
      </div>
    ))}</div>;
  }
  if (kind === "skills") {
    return <div className="flex flex-wrap gap-2">{data.map((s: string) => <span key={s} className="px-3 py-1 rounded-full text-[12px] border border-black/15">{s}</span>)}</div>;
  }
  return <ul className="space-y-1.5 text-[14px] text-muted-foreground">{data.map((s: string, i: number) => <li key={i}>— {s}</li>)}</ul>;
}

