import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startInterview, submitAnswer, finalizeInterview } from "@/lib/interviews.functions";
import { getPrep } from "@/lib/preps.functions";
import { listMyResumes } from "@/lib/resumes.functions";

export const Route = createFileRoute("/candidate/interview")({
  head: () => ({
    meta: [
      { title: "AI Interview — Hirely.ai" },
      { name: "description", content: "Adaptive AI interview with continuous real-time evaluation and voice or typed responses." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    resumeId: typeof s.resumeId === "string" ? s.resumeId : undefined,
    role: typeof s.role === "string" ? s.role : undefined,
    prepId: typeof s.prepId === "string" ? s.prepId : undefined,
    mode: typeof s.mode === "string" ? s.mode : undefined,
  }),
  component: InterviewRoom,
});

type Stage = "setup" | "prompt" | "recording" | "typing" | "thinking" | "feedback" | "finalizing" | "complete";
type Mode = "HR" | "Technical" | "Behavioral" | "Mixed" | "Mock Final";

type Evaluation = {
  overall: number;
  strengths: string[];
  weaknesses: string[];
  how_to_improve: string[];
  better_answer_example: string;
  technical_accuracy?: number; communication?: number; confidence?: number; clarity?: number;
  grammar?: number; completeness?: number; relevance?: number; professionalism?: number; star_usage?: number; structure?: number;
};

function InterviewRoom() {
  const search = useSearch({ from: "/candidate/interview" });
  const nav = useNavigate();
  const [stage, setStage] = useState<Stage>("setup");
  const [roleTarget, setRoleTarget] = useState(search.role ?? "Senior Frontend Engineer");
  const [resumeId, setResumeId] = useState<string | undefined>(search.resumeId);
  const [prepId, setPrepId] = useState<string | undefined>(search.prepId);
  const [mode, setMode] = useState<Mode>((search.mode as Mode) ?? "Mixed");
  const [resumeOptions, setResumeOptions] = useState<Array<{ id: string; file_name: string }>>([]);

  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [qIndex, setQIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [typing, setTyping] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [difficulty, setDifficulty] = useState<number>(50);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [autoStart, setAutoStart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startFn = useServerFn(startInterview);
  const answerFn = useServerFn(submitAnswer);
  const finalizeFn = useServerFn(finalizeInterview);
  const listFn = useServerFn(listMyResumes);
  const prepFn = useServerFn(getPrep);
  const recRef = useRef<any>(null);

  useEffect(() => {
    listFn().then(rs => setResumeOptions((rs ?? []).map(r => ({ id: r.id, file_name: r.file_name })))).catch(() => {});
  }, [listFn]);

  // If a prepId is in URL, hydrate & auto-start
  useEffect(() => {
    if (!prepId || autoStart) return;
    setAutoStart(true);
    prepFn({ data: { id: prepId } }).then((p) => {
      if (!p) return;
      setRoleTarget(p.role_target);
      setResumeId(p.resume_id ?? undefined);
      setMode((p.mode as Mode) ?? "Mixed");
      // Directly begin
      queueMicrotask(() => beginWith(p.role_target, p.resume_id ?? undefined, (p.mode as Mode) ?? "Mixed", p.id));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepId]);

  useEffect(() => {
    if (stage !== "recording") return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [stage]);

  async function beginWith(role: string, rid: string | undefined, m: Mode, pid?: string) {
    setError(null); setStage("thinking");
    try {
      const res = await startFn({ data: { resumeId: rid, roleTarget: role, mode: m, prepId: pid } });
      setInterviewId(res.interviewId);
      setQuestion(res.question); setQIndex(res.idx);
      setTranscript(""); setInterim(""); setTyping(""); setEvaluation(null);
      setStage("prompt");
    } catch (e: any) {
      setError(e?.message ?? "Failed to start interview");
      setStage("setup");
    }
  }
  const begin = () => beginWith(roleTarget, resumeId, mode, prepId);

  function startRecording() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("Voice recognition not supported. Try Chrome, or type instead."); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (ev: any) => {
      let interimText = "", finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript(t => (t + finalText).trim() + " ");
      setInterim(interimText);
    };
    rec.onerror = (e: any) => { if (e.error === "not-allowed") { setError("Microphone access denied."); setStage("prompt"); } };
    rec.onend = () => { if (recRef.current === rec) recRef.current = null; };
    try { rec.start(); recRef.current = rec; setTranscript(""); setInterim(""); setStage("recording"); }
    catch (e: any) { console.warn(e); }
  }
  function stopRecording() { try { recRef.current?.stop(); } catch {} recRef.current = null; }

  async function submitTurn(source: "voice" | "text") {
    if (!interviewId) return;
    if (stage === "thinking") return;
    let full = "";
    if (source === "voice") { stopRecording(); full = (transcript + " " + interim).trim(); }
    else full = typing.trim();
    if (full.length < 3) { setError("Please provide an answer first."); return; }
    setError(null); setStage("thinking");
    try {
      const res = await answerFn({ data: { interviewId, idx: qIndex, transcript: full } });
      setEvaluation(res.evaluation as Evaluation);
      if (res.done) {
        // Show feedback then finalize
        setStage("feedback");
      } else {
        setQuestion(res.question!);
        setQIndex(res.idx!);
        setDifficulty(res.difficulty ?? difficulty);
        setStage("feedback");
        (window as any).__pendingNext = true;
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to evaluate");
      setStage("prompt");
    }
  }

  function continueNext() {
    setTranscript(""); setInterim(""); setTyping(""); setEvaluation(null);
    if ((window as any).__pendingNext) { (window as any).__pendingNext = false; setStage("prompt"); }
    else finalize();
  }

  async function finalize() {
    if (!interviewId) return;
    setStage("finalizing");
    try {
      const r = await finalizeFn({ data: { interviewId } });
      nav({ to: "/candidate/report", search: { interviewId: r.interviewId } as any });
    } catch (e: any) {
      setError(e?.message ?? "Failed to finalize");
      setStage("feedback");
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0A0A0B] text-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-70"
           style={{ background: "radial-gradient(60% 60% at 50% 40%, rgba(220,200,160,.08), transparent 70%)" }} />
      <Stars />

      <div className="absolute top-0 inset-x-0 z-30 px-6 py-5 flex items-center justify-between">
        <Link to="/candidate" className="text-[11px] tracking-[.24em] uppercase text-white/50 hover:text-white transition-colors">← Exit Room</Link>
        <div className="text-[11px] tracking-[.24em] uppercase text-white/50 flex items-center gap-6">
          {stage !== "setup" && <span>{mode}</span>}
          {stage !== "setup" && <span>Q{qIndex + 1} · Difficulty {difficulty}</span>}
        </div>
      </div>

      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 text-sm text-red-300 bg-red-900/40 px-4 py-2 rounded-full">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {stage === "setup" && (
          <SetupScreen
            key="setup"
            roleTarget={roleTarget} setRoleTarget={setRoleTarget}
            resumeId={resumeId} setResumeId={setResumeId}
            resumeOptions={resumeOptions}
            mode={mode} setMode={setMode}
            onBegin={begin}
          />
        )}

        {(stage === "prompt" || stage === "recording" || stage === "typing" || stage === "thinking") && (
          <motion.div
            key={"qa-" + qIndex}
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center px-8"
          >
            <div className="max-w-4xl w-full text-center">
              <div className="text-[11px] tracking-[.32em] uppercase text-white/40 mb-10">
                {stage === "thinking" ? "Reasoning…" : "Interviewer"}
              </div>
              <TypedQuestion text={question || "…"} key={question} />

              <div className="mt-16 flex flex-col items-center">
                {stage === "recording" ? (
                  <Waveform />
                ) : stage === "typing" ? null : (
                  <div className="flex items-center gap-8">
                    <button
                      onClick={startRecording}
                      disabled={stage === "thinking"}
                      className="group relative w-24 h-24 rounded-full bg-white text-ink flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-40"
                      aria-label="Start recording"
                    >
                      <span className="absolute inset-0 rounded-full" style={{ animation: "mic-ring 2.2s ease-out infinite", background: "rgba(255,255,255,.18)" }} />
                      <MicIcon />
                    </button>
                    <button
                      onClick={() => setStage("typing")}
                      disabled={stage === "thinking"}
                      className="text-[12px] tracking-[.22em] uppercase text-white/50 hover:text-white transition-colors"
                    >
                      or type instead
                    </button>
                  </div>
                )}

                <div className="mt-6 text-[11px] tracking-[.24em] uppercase text-white/40">
                  {stage === "recording" ? `Recording · ${fmt(elapsed)}` : stage === "thinking" ? "Evaluating with Groq" : stage === "typing" ? "Typing…" : "Speak or type your answer"}
                </div>
              </div>

              {stage === "typing" ? (
                <div className="mt-10 max-w-2xl mx-auto text-left">
                  <textarea
                    autoFocus
                    value={typing}
                    onChange={(e) => setTyping(e.target.value)}
                    placeholder="Type your answer…"
                    className="w-full min-h-[180px] bg-white/5 border border-white/10 rounded-2xl p-5 outline-none text-white/90 leading-relaxed resize-none focus:border-white/40"
                  />
                  <div className="mt-5 flex items-center justify-between">
                    <button onClick={() => { setStage("prompt"); setTyping(""); }} className="text-[12px] text-white/50 hover:text-white transition-colors">Cancel</button>
                    <button onClick={() => submitTurn("text")} className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white text-ink text-[13px] hover:bg-white/90 transition-colors">Submit answer →</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-10 min-h-[80px] max-w-2xl mx-auto text-white/75 text-lg leading-relaxed">
                    {transcript}
                    <span className="text-white/40">{interim}</span>
                    {stage === "recording" && (
                      <span className="inline-block w-[7px] h-[1.1em] align-middle bg-white/70 ml-1" style={{ animation: "caret 1s steps(1) infinite" }} />
                    )}
                  </div>
                  {stage === "recording" && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-6 flex items-center justify-center gap-8">
                      <button onClick={() => { stopRecording(); setStage("prompt"); }} className="text-[12px] tracking-wide text-white/50 hover:text-white transition-colors">Cancel</button>
                      <button onClick={() => submitTurn("voice")} className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white text-ink text-[13px] hover:bg-white/90 transition-colors">Submit answer →</button>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {stage === "feedback" && evaluation && (
          <FeedbackScreen
            key={"fb-" + qIndex}
            evaluation={evaluation}
            more={(window as any).__pendingNext === true}
            onContinue={continueNext}
            onFinish={finalize}
          />
        )}

        {stage === "finalizing" && (
          <motion.div key="fin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/60 text-sm tracking-[.24em] uppercase">Synthesizing final evaluation…</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SetupScreen({ roleTarget, setRoleTarget, resumeId, setResumeId, resumeOptions, mode, setMode, onBegin }: {
  roleTarget: string; setRoleTarget: (s: string) => void;
  resumeId: string | undefined; setResumeId: (s: string | undefined) => void;
  resumeOptions: Array<{ id: string; file_name: string }>;
  mode: Mode; setMode: (m: Mode) => void;
  onBegin: () => void;
}) {
  const modes: Mode[] = ["HR", "Technical", "Behavioral", "Mixed", "Mock Final"];
  return (
    <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center px-8">
      <div className="max-w-lg w-full">
        <div className="text-[11px] tracking-[.32em] uppercase text-white/40 mb-6">Prepare</div>
        <h2 className="font-serif text-5xl mb-10">Set the room.</h2>
        <div className="space-y-8">
          <label className="block">
            <div className="text-[11px] tracking-[.24em] uppercase text-white/40 mb-2">Role</div>
            <input value={roleTarget} onChange={(e) => setRoleTarget(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 py-3 outline-none text-lg focus:border-white transition-colors" />
          </label>
          <label className="block">
            <div className="text-[11px] tracking-[.24em] uppercase text-white/40 mb-2">Resume</div>
            <select value={resumeId ?? ""} onChange={(e) => setResumeId(e.target.value || undefined)}
              className="w-full bg-transparent border-b border-white/20 py-3 outline-none text-lg focus:border-white transition-colors">
              <option value="" className="bg-[#0A0A0B]">No resume — general</option>
              {resumeOptions.map(r => <option key={r.id} value={r.id} className="bg-[#0A0A0B]">{r.file_name}</option>)}
            </select>
          </label>
          <div>
            <div className="text-[11px] tracking-[.24em] uppercase text-white/40 mb-3">Mode</div>
            <div className="flex flex-wrap gap-2">
              {modes.map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={"px-3 py-1.5 rounded-full text-[12px] border transition-colors " + (mode === m ? "border-white bg-white text-ink" : "border-white/25 text-white/70 hover:border-white/60")}>{m}</button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onBegin} className="mt-10 w-full py-4 rounded-full bg-white text-ink text-[13px] tracking-wide hover:bg-white/90 transition-colors">Begin interview →</button>
        <div className="mt-6 text-center">
          <Link to="/candidate/prepare" search={{ resumeId: undefined }} className="text-[12px] tracking-wide text-white/40 hover:text-white transition-colors">Detailed prep (JD, level, company) →</Link>
        </div>
      </div>
    </motion.div>
  );
}

function FeedbackScreen({ evaluation, more, onContinue, onFinish }: { evaluation: Evaluation; more: boolean; onContinue: () => void; onFinish: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto px-8 py-24">
        <div className="text-[11px] tracking-[.32em] uppercase text-white/40 mb-4">Real-time evaluation</div>
        <div className="flex items-end gap-8 border-b border-white/10 pb-8">
          <div className="font-serif text-[18vw] md:text-[11vw] leading-[0.8] text-white/95">{evaluation.overall}</div>
          <div className="pb-3 text-lg text-white/60">Overall — this answer</div>
        </div>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-6">
          <Metric label="Technical" v={evaluation.technical_accuracy} />
          <Metric label="Communication" v={evaluation.communication} />
          <Metric label="Confidence" v={evaluation.confidence} />
          <Metric label="Clarity" v={evaluation.clarity} />
          <Metric label="STAR" v={evaluation.star_usage} />
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
          <FbList title="Strengths" items={evaluation.strengths ?? []} />
          <FbList title="To improve" items={evaluation.weaknesses ?? []} muted />
          <FbList title="How to improve" items={evaluation.how_to_improve ?? []} />
          <div>
            <div className="text-[10px] tracking-[.28em] uppercase text-white/40 mb-3">Example of a stronger answer</div>
            <div className="text-white/75 leading-relaxed">{evaluation.better_answer_example}</div>
          </div>
        </div>

        <div className="mt-14 flex items-center justify-between border-t border-white/10 pt-8">
          <button onClick={onFinish} className="text-[12px] tracking-wide text-white/50 hover:text-white transition-colors">End interview & see report →</button>
          <button onClick={onContinue} className="px-6 py-3 rounded-full bg-white text-ink text-[13px] hover:bg-white/90 transition-colors">
            {more ? "Next question →" : "Finish & synthesize →"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, v }: { label: string; v: number | undefined }) {
  return (
    <div>
      <div className="text-[10px] tracking-[.28em] uppercase text-white/40">{label}</div>
      <div className="mt-2 text-2xl text-white font-serif">{Math.round(Number(v ?? 0))}</div>
    </div>
  );
}
function FbList({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div>
      <div className="text-[10px] tracking-[.28em] uppercase text-white/40 mb-3">{title}</div>
      <ul className={"space-y-2 " + (muted ? "text-white/50" : "text-white/85")}>
        {items.map((s, i) => <li key={i}>— {s}</li>)}
      </ul>
    </div>
  );
}

function TypedQuestion({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = window.setInterval(() => { i += 1; setShown(text.slice(0, i)); if (i >= text.length) window.clearInterval(id); }, 22);
    return () => window.clearInterval(id);
  }, [text]);
  return (
    <h2 className="text-3xl md:text-5xl font-normal tracking-tight leading-[1.1]" style={{ fontFamily: "var(--font-serif)" }}>
      {shown}
      <span className="inline-block w-[8px] h-[1em] align-middle ml-2 bg-white/80" style={{ animation: "caret 1s steps(1) infinite" }} />
    </h2>
  );
}
function Waveform() {
  const bars = useMemo(() => Array.from({ length: 42 }), []);
  return (
    <div className="flex items-center gap-[3px] h-24">
      {bars.map((_, i) => (
        <span key={i} className="w-[3px] rounded-full bg-white/80"
          style={{ height: `${20 + (i % 7) * 8}px`, animation: `wave-bar ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite` }} />
      ))}
    </div>
  );
}
function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
    </svg>
  );
}
function Stars() {
  const pts = useMemo(() => Array.from({ length: 80 }).map((_, i) => ({
    x: (Math.sin(i * 3.1) * 0.5 + 0.5) * 100,
    y: (Math.cos(i * 2.3) * 0.5 + 0.5) * 100,
    o: 0.15 + ((i * 7) % 10) / 40,
    d: (i % 5) * 0.6,
  })), []);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {pts.map((p, i) => (
        <span key={i} className="absolute w-[2px] h-[2px] rounded-full bg-white" style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: p.o, animation: `soft-pulse ${3 + p.d}s ease-in-out ${p.d}s infinite` }} />
      ))}
    </div>
  );
}
function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}
