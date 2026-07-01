import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { listMyResumes, rewriteResumeSection, saveImprovedVersion, getResume } from "@/lib/resumes.functions";

export const Route = createFileRoute("/candidate/improve")({
  head: () => ({ meta: [{ title: "Improve Resume — Hirely.ai" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    resumeId: typeof s.resumeId === "string" ? s.resumeId : undefined,
  }),
  component: ImprovePage,
});

const TARGETS = [
  { key: "summary", label: "Professional summary" },
  { key: "experience", label: "Experience" },
  { key: "projects", label: "Projects" },
  { key: "skills", label: "Skills" },
  { key: "achievements", label: "Achievements" },
  { key: "certifications", label: "Certifications" },
  { key: "education", label: "Education" },
] as const;

function ImprovePage() {
  const { resumeId: initialId } = useSearch({ from: "/candidate/improve" });
  const listFn = useServerFn(listMyResumes);
  const getFn = useServerFn(getResume);
  const rewriteFn = useServerFn(rewriteResumeSection);
  const saveFn = useServerFn(saveImprovedVersion);

  const [resumes, setResumes] = useState<Array<{ id: string; file_name: string; label: string | null }>>([]);
  const [resumeId, setResumeId] = useState<string | undefined>(initialId);
  const [structured, setStructured] = useState<any>(null);
  const [target, setTarget] = useState<typeof TARGETS[number]["key"]>("summary");
  const [instr, setInstr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ original: string; rewritten: string; notes: string[] } | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    listFn().then(rs => {
      setResumes((rs ?? []).map(r => ({ id: r.id, file_name: r.file_name, label: r.label })));
      if (!resumeId && rs?.[0]) setResumeId(rs[0].id);
    }).catch(() => {});
  }, [listFn, resumeId]);

  useEffect(() => {
    if (!resumeId) return;
    getFn({ data: { id: resumeId } }).then(r => setStructured(r?.structured ?? null)).catch(() => {});
  }, [resumeId, getFn]);

  async function runRewrite() {
    if (!resumeId) return;
    setLoading(true); setResult(null); setSavedMsg(null);
    try {
      const out = await rewriteFn({ data: { resumeId, target, instructions: instr || undefined } });
      setResult(out);
    } finally { setLoading(false); }
  }

  async function saveVersion() {
    if (!resumeId || !result) return;
    setSavedMsg(null);
    let patch: any = {};
    try {
      const parsed = JSON.parse(result.rewritten);
      patch[target] = parsed;
    } catch {
      patch[target] = result.rewritten;
    }
    const label = `Improved · ${TARGETS.find(t => t.key === target)?.label} · ${new Date().toLocaleDateString()}`;
    const v = await saveFn({ data: { parentId: resumeId, label, patch } });
    setSavedMsg(`Saved as "${v.label}"`);
  }

  return (
    <main className="pt-32 pb-24 px-6 md:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-center gap-3 mb-12">
          <span className="eyebrow">Improve</span>
          <span className="hairline flex-1" />
          <Link to="/candidate" className="text-[12px] tracking-wide text-muted-foreground hover:text-ink">← Studio</Link>
        </div>

        <h1 className="display-xl text-[10vw] md:text-[6.5vw] leading-[0.95]">
          Rewrite it. <span className="text-muted-foreground/70">Stronger.</span>
        </h1>

        <div className="mt-14 grid grid-cols-12 gap-y-10 md:gap-x-10">
          <aside className="col-span-12 md:col-span-4">
            <div className="eyebrow mb-4">Resume</div>
            <select value={resumeId ?? ""} onChange={(e) => { setResumeId(e.target.value || undefined); setResult(null); }}
              className="w-full bg-transparent border-b border-black/15 py-3 outline-none">
              {resumes.map(r => <option key={r.id} value={r.id}>{r.label || r.file_name}</option>)}
            </select>

            <div className="eyebrow mt-10 mb-4">Section to rewrite</div>
            <div className="flex flex-col gap-1">
              {TARGETS.map(t => (
                <button key={t.key} onClick={() => { setTarget(t.key); setResult(null); }}
                  className={"text-left py-2 text-[15px] border-l-2 pl-3 transition-colors " + (target === t.key ? "border-ink text-ink" : "border-transparent text-muted-foreground hover:text-ink")}>{t.label}</button>
              ))}
            </div>

            <div className="eyebrow mt-10 mb-3">Extra guidance <span className="opacity-60 normal-case tracking-normal">(optional)</span></div>
            <textarea value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="e.g. Focus on measurable impact, keep it under 3 bullets per role."
              className="w-full min-h-[100px] glass-panel rounded-xl p-4 outline-none text-[14px] resize-none" />

            <button onClick={runRewrite} disabled={!resumeId || loading}
              className="mt-6 w-full py-3 rounded-full bg-ink text-background text-[13px] hover:bg-black/85 transition-colors disabled:opacity-50">
              {loading ? "Rewriting…" : "Rewrite with AI →"}
            </button>
          </aside>

          <section className="col-span-12 md:col-span-8">
            {result ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Panel title="Original" content={result.original} muted />
                <Panel title="Improved" content={result.rewritten} highlight />
                <div className="md:col-span-2 glass-panel rounded-2xl p-6">
                  <div className="eyebrow mb-3">What changed</div>
                  <ul className="space-y-2 text-[14px]">
                    {result.notes.map((n, i) => <li key={i}>— {n}</li>)}
                  </ul>
                </div>
                <div className="md:col-span-2 flex items-center justify-between border-t border-black/10 pt-6">
                  <div className="text-[13px] text-muted-foreground">{savedMsg ?? "Save this rewrite as a new resume version."}</div>
                  <button onClick={saveVersion} className="px-6 py-3 rounded-full bg-ink text-background text-[13px] hover:bg-black/85">Save version →</button>
                </div>
              </motion.div>
            ) : (
              <div className="glass-panel rounded-2xl p-8">
                <div className="eyebrow mb-4">Current {TARGETS.find(t => t.key === target)?.label}</div>
                <pre className="whitespace-pre-wrap text-[14px] text-muted-foreground leading-relaxed max-h-[520px] overflow-y-auto">
                  {structured?.[target] ? JSON.stringify(structured[target], null, 2) : "—"}
                </pre>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Panel({ title, content, muted, highlight }: { title: string; content: string; muted?: boolean; highlight?: boolean }) {
  let display = content;
  try { const p = JSON.parse(content); display = JSON.stringify(p, null, 2); } catch {}
  return (
    <div className={"rounded-2xl p-6 " + (highlight ? "bg-ink text-background" : "glass-panel " + (muted ? "text-muted-foreground" : ""))}>
      <div className="text-[10px] tracking-[.28em] uppercase opacity-60 mb-3">{title}</div>
      <pre className="whitespace-pre-wrap text-[13.5px] leading-relaxed max-h-[520px] overflow-y-auto">{display}</pre>
    </div>
  );
}
