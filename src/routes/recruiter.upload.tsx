import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recruiterUploadResume } from "@/lib/recruiter-candidates.functions";

export const Route = createFileRoute("/recruiter/upload")({
  head: () => ({
    meta: [
      { title: "Upload — Hirely.ai Recruiter" },
      { name: "description", content: "Drop in resumes. Hirely.ai builds candidate profiles automatically." },
    ],
  }),
  component: UploadPage,
});

type Item = {
  id: string;
  fileName: string;
  size: number;
  stage: "queued" | "parsing" | "analyzing" | "extracting" | "ranking" | "done" | "error";
  score?: number;
  name?: string;
  err?: string;
};

const STAGES: Item["stage"][] = ["queued", "parsing", "analyzing", "extracting", "ranking", "done"];
const STAGE_LABEL: Record<Item["stage"], string> = {
  queued: "Queued",
  parsing: "Parsing",
  analyzing: "Analyzing",
  extracting: "Extracting skills",
  ranking: "Ranking",
  done: "Ready",
  error: "Failed",
};

function UploadPage() {
  const uploadFn = useServerFn(recruiterUploadResume);
  const nav = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setProcessing(true);
    const start: Item[] = files.map(f => ({
      id: crypto.randomUUID(), fileName: f.name, size: f.size, stage: "queued",
    }));
    setItems(prev => [...start, ...prev]);

    // Process sequentially so the API isn't hammered.
    for (const [i, f] of files.entries()) {
      const id = start[i].id;
      try {
        // Cycle visual stages while awaiting
        const set = (stage: Item["stage"]) =>
          setItems(prev => prev.map(it => it.id === id ? { ...it, stage } : it));
        set("parsing");

        const b64 = await fileToBase64(f);
        set("analyzing");

        // Fake staged progress alongside real work
        const staged = (async () => {
          await sleep(700); set("extracting");
          await sleep(900); set("ranking");
        })();

        const res = await uploadFn({ data: { fileName: f.name, mimeType: f.type || "application/pdf", contentBase64: b64 } });
        await staged;
        setItems(prev => prev.map(it => it.id === id ? { ...it, stage: "done", score: res.score, name: res.name } : it));
      } catch (e: any) {
        setItems(prev => prev.map(it => it.id === id ? { ...it, stage: "error", err: e?.message ?? "Failed" } : it));
      }
    }
    setProcessing(false);
  }, [uploadFn]);

  const anyDone = items.some(i => i.stage === "done");

  return (
    <main className="pt-28 pb-24 px-6 min-h-screen">
      <section className="max-w-[1200px] mx-auto">
        <div className="eyebrow mb-4">Upload</div>
        <h1 className="font-serif italic text-[7vw] md:text-[5.5vw] leading-[0.95] tracking-tight">Drop the resumes.</h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl">One file or five hundred. Hirely.ai parses each one, extracts every skill, and ranks them the moment they finish.</p>

        <motion.div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false);
            const files = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|docx?|txt|png|jpe?g)$/i.test(f.name));
            process(files);
          }}
          animate={{ borderColor: dragOver ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.12)" }}
          className="mt-14 relative border border-dashed rounded-3xl px-10 py-20 md:py-28 text-center cursor-pointer bg-white/40 backdrop-blur-sm overflow-hidden"
          onClick={() => inputRef.current?.click()}
        >
          <AnimatePresence>
            {dragOver && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-ink/[0.03]" />
            )}
          </AnimatePresence>
          <div className="relative">
            <div className="mx-auto w-14 h-14 rounded-full border border-black/15 flex items-center justify-center mb-6 text-ink">
              <motion.div animate={{ y: dragOver ? -3 : 0 }} transition={{ type: "spring", stiffness: 200 }}>↑</motion.div>
            </div>
            <div className="font-serif italic text-3xl md:text-4xl">Drag resumes here</div>
            <div className="mt-3 text-sm text-muted-foreground">or <span className="underline">browse your computer</span> — PDF, DOCX, TXT, images</div>
            <div className="mt-6 text-[10.5px] tracking-[.24em] uppercase text-muted-foreground">Single · Bulk · Whole folders</div>
          </div>
          <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg" className="hidden"
            onChange={e => process(Array.from(e.target.files ?? []))} />
        </motion.div>

        <AnimatePresence>
          {items.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-14">
              <div className="flex items-center justify-between mb-4">
                <div className="eyebrow">Queue · {items.length}</div>
                {anyDone && !processing && (
                  <button
                    onClick={() => nav({ to: "/recruiter/candidates" })}
                    className="px-4 py-2 rounded-full bg-ink text-background text-[12px]">
                    Open ranking →
                  </button>
                )}
              </div>
              <ul className="divide-y divide-black/5 border-t border-b border-black/5">
                {items.map(it => <QueueRow key={it.id} it={it} />)}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

function QueueRow({ it }: { it: Item }) {
  const idx = STAGES.indexOf(it.stage);
  const isErr = it.stage === "error";
  const isDone = it.stage === "done";
  return (
    <li className="grid grid-cols-12 items-center py-5 gap-4">
      <div className="col-span-4 min-w-0">
        <div className="text-[14px] truncate">{it.name ?? it.fileName}</div>
        <div className="text-[11px] text-muted-foreground truncate">{(it.size / 1024).toFixed(0)} KB · {it.fileName}</div>
      </div>
      <div className="col-span-6">
        <div className="flex items-center gap-2">
          {STAGES.slice(0, 5).map((s, i) => {
            const active = !isErr && i <= idx;
            const current = !isErr && !isDone && i === idx;
            return (
              <div key={s} className="flex-1 relative h-[3px] rounded-full bg-black/[0.08] overflow-hidden">
                {active && (
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: current ? "60%" : "100%" }}
                    transition={{ duration: current ? 1.4 : 0.4, ease: "easeOut", repeat: current ? Infinity : 0, repeatType: "reverse" }}
                    className="absolute inset-y-0 left-0 bg-ink"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[10.5px] tracking-[.22em] uppercase text-muted-foreground">
          {isErr ? `Error — ${it.err}` : STAGE_LABEL[it.stage]}
        </div>
      </div>
      <div className="col-span-2 text-right">
        {isDone ? (
          <div>
            <div className="font-serif text-3xl leading-none">{it.score ?? "—"}</div>
            <div className="text-[9.5px] tracking-[.22em] uppercase text-muted-foreground mt-1">Score</div>
          </div>
        ) : isErr ? (
          <span className="text-[11px] text-red-600">Failed</span>
        ) : (
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-[11px] text-muted-foreground">Working…</motion.div>
        )}
      </div>
    </li>
  );
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
