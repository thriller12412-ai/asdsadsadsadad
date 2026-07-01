import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hirely.ai — AI Interview Prep & Recruiter Intelligence" },
      { name: "description", content: "Hirely.ai is the AI hiring operating system. Candidates prepare with adaptive interviews and resume coaching. Recruiters rank, compare, and decide faster." },
      { property: "og:title", content: "Hirely.ai — AI Interview Prep & Recruiter Intelligence" },
      { property: "og:description", content: "Adaptive AI interviews for candidates. Instant ranking and reasoning for recruiters. Finding talent shouldn't depend on luck." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://mindful-hiring-muse.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Hirely.ai — AI Interview Prep & Recruiter Intelligence" },
      { name: "twitter:description", content: "Adaptive AI interviews for candidates. Instant ranking and reasoning for recruiters." },
    ],
    links: [{ rel: "canonical", href: "https://mindful-hiring-muse.lovable.app/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Hirely.ai",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "AI hiring operating system for candidates and recruiters.",
        url: "https://mindful-hiring-muse.lovable.app/",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }),
    }],
  }),
  component: HirelyAI,
});

/* ---------- Shared bits ---------- */

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 px-8 py-6 flex items-center justify-between mix-blend-difference text-white/90">
      <a href="#" className="text-[13px] tracking-[0.02em] font-medium">
        Hirely.ai<span className="text-champagne">*</span>
      </a>
      <nav className="hidden md:flex items-center gap-10 text-[12px] tracking-[0.14em] uppercase">
        <a href="#act1" className="hover:opacity-60 transition-opacity">Index</a>
        <a href="#act2" className="hover:opacity-60 transition-opacity">Intelligence</a>
        <a href="#act3" className="hover:opacity-60 transition-opacity">Decision</a>
      </nav>
      <a href="#act3" className="text-[12px] tracking-[0.14em] uppercase flex items-center gap-2 group">
        <span>Enter</span>
        <span className="inline-block w-6 h-px bg-current group-hover:w-10 transition-all" />
      </a>
    </header>
  );
}

/* Drifting paper sheets background — layered depth (far / mid / near) */
function PaperField({ density = 80, intensity = 1 }: { density?: number; intensity?: number }) {
  const sheets = useMemo(() => {
    return Array.from({ length: density }).map((_, i) => {
      const seed = i * 9301 + 49297;
      const r = (n: number) => ((Math.sin(seed * n) + 1) / 2);
      const z = r(1.1); // 0..1 depth
      // 3 depth bands for cinematic layering
      const band = z < 0.34 ? 0 : z < 0.72 ? 1 : 2; // 0=far, 1=mid, 2=near
      const scale = band === 0 ? 0.35 + r(1.9) * 0.25 : band === 1 ? 0.7 + r(2.1) * 0.4 : 1.15 + r(2.3) * 0.7;
      const opacity = band === 0 ? 0.18 + r(3.1) * 0.15 : band === 1 ? 0.55 + r(3.3) * 0.25 : 0.85 + r(3.5) * 0.15;
      const blur = band === 0 ? 3 + r(4.1) * 2 : band === 1 ? 0.6 + r(4.3) * 0.8 : 0;
      return {
        id: i,
        band,
        left: r(2.7) * 110 - 5,
        top: r(3.3) * 140 - 20,
        rot: (r(4.4) - 0.5) * 60,
        scale,
        opacity,
        blur,
        dur: 14 + r(7.7) * 18,
        parallax: band === 0 ? 0.25 : band === 1 ? 0.6 : 1.15,
        _intensity: intensity,
      };
    });
  }, [density, intensity]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {sheets.map((s) => (
        <div
          key={s.id}
          className="absolute will-change-transform"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            transform: `rotate(${s.rot}deg) scale(${s.scale})`,
            opacity: s.opacity,
            filter: `blur(${s.blur}px)`,
            animation: `float-y ${s.dur}s ease-in-out infinite`,
            ["--r" as never]: `${s.rot}deg`,
          }}
        >
          <div
            className="w-[120px] h-[160px] rounded-[3px] bg-white"
            style={{
              boxShadow:
                s.band === 2
                  ? "0 40px 80px -30px rgba(30,22,10,.35), 0 12px 28px -12px rgba(30,22,10,.22), 0 2px 4px rgba(30,22,10,.08)"
                  : s.band === 1
                  ? "0 22px 44px -22px rgba(40,30,10,.28), 0 6px 14px -8px rgba(40,30,10,.14)"
                  : "0 10px 24px -12px rgba(40,30,10,.18)",
              border: "1px solid rgba(0,0,0,.05)",
            }}
          >
            <div className="p-3 space-y-1.5">
              <div className="h-1 w-8 bg-ink/25 rounded-sm" />
              <div className="h-0.5 w-16 bg-ink/12 rounded-sm" />
              <div className="h-0.5 w-12 bg-ink/12 rounded-sm" />
              <div className="mt-3 space-y-1">
                <div className="h-0.5 w-full bg-ink/10 rounded-sm" />
                <div className="h-0.5 w-5/6 bg-ink/10 rounded-sm" />
                <div className="h-0.5 w-4/6 bg-ink/10 rounded-sm" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Foreground bokeh — huge, blurred sheets that drift across the viewport */
function ForegroundBokeh({ mx, my }: { mx: import("framer-motion").MotionValue<number>; my: import("framer-motion").MotionValue<number> }) {
  const x1 = useTransform(mx, (v) => v * 80);
  const y1 = useTransform(my, (v) => v * 60);
  const x2 = useTransform(mx, (v) => v * -110);
  const y2 = useTransform(my, (v) => v * -70);
  const x3 = useTransform(mx, (v) => v * 60);
  const y3 = useTransform(my, (v) => v * -40);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]">
      <motion.div
        className="absolute -top-32 -left-20 w-[520px] h-[680px] rounded-[6px] bg-white/70"
        style={{ x: x1, y: y1, rotate: 32, filter: "blur(28px)", boxShadow: "0 60px 120px -40px rgba(30,22,10,.35)" }}
      />
      <motion.div
        className="absolute -bottom-52 -right-24 w-[620px] h-[780px] rounded-[6px] bg-white/70"
        style={{ x: x2, y: y2, rotate: -18, filter: "blur(36px)", boxShadow: "0 80px 160px -50px rgba(30,22,10,.4)" }}
      />
      <motion.div
        className="absolute top-[35%] -right-32 w-[380px] h-[500px] rounded-[6px] bg-white/60"
        style={{ x: x3, y: y3, rotate: -8, filter: "blur(22px)", boxShadow: "0 40px 90px -30px rgba(30,22,10,.3)" }}
      />
    </div>
  );
}

/* The hero resume "object" */
function ResumeObject({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`relative w-[300px] md:w-[340px] aspect-[3/4] rounded-[10px] ${
        dark ? "dark-paper" : "paper-card"
      }`}
    >
      <div className="p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${dark ? "bg-white/10" : "bg-ink/10"}`} />
          <div>
            <div className={`text-[13px] font-medium ${dark ? "text-white" : "text-ink"}`}>Aaryan Garg</div>
            <div className={`text-[10px] ${dark ? "text-white/50" : "text-muted-foreground"}`}>Full Stack Developer</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className={`text-[9px] tracking-[0.18em] uppercase ${dark ? "text-white/40" : "text-muted-foreground"}`}>Experience</div>
          <div className={`text-[11px] ${dark ? "text-white/80" : "text-ink/80"}`}>Software Developer Intern</div>
          <div className={`text-[9px] ${dark ? "text-white/40" : "text-muted-foreground"}`}>Gable Studio · Jan 2024 — Present</div>
          <ul className={`text-[10px] space-y-0.5 pl-3 list-disc ${dark ? "text-white/60" : "text-ink/60"}`}>
            <li>Built responsive apps with Next.js</li>
            <li>Improved performance by 20%</li>
            <li>Worked on AI integration</li>
          </ul>
        </div>
        <div className="space-y-2">
          <div className={`text-[9px] tracking-[0.18em] uppercase ${dark ? "text-white/40" : "text-muted-foreground"}`}>Education</div>
          <div className={`text-[11px] ${dark ? "text-white/80" : "text-ink/80"}`}>B.Tech Computer Science</div>
          <div className={`text-[9px] ${dark ? "text-white/40" : "text-muted-foreground"}`}>GLA University · 2021 — 2025</div>
        </div>
        <div className="space-y-2">
          <div className={`text-[9px] tracking-[0.18em] uppercase ${dark ? "text-white/40" : "text-muted-foreground"}`}>Skills</div>
          <div className="flex flex-wrap gap-1.5">
            {["React", "Next.js", "Node.js", "Python", "AWS", "MongoDB", "Docker", "Tailwind"].map((s) => (
              <span
                key={s}
                className={`text-[9px] px-1.5 py-0.5 rounded-sm ${
                  dark ? "text-white/70 border border-white/15" : "text-ink/70 border border-ink/10"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- ACT 01 ---------- */

function ActOne() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });

  // Resume morphs: grows as user scrolls, papers accelerate away
  const resumeScale = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1.4, 3.2]);
  const resumeY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const fieldOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 0.5, 0]);
  const fieldScale = useTransform(scrollYProgress, [0, 1], [1, 1.4]);
  const headingY = useTransform(scrollYProgress, [0, 0.4], [0, -200]);
  const headingOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);
  const whiteWash = useTransform(scrollYProgress, [0.75, 1], [0, 1]);

  return (
    <section
      id="act1"
      ref={ref}
      className="relative h-[260vh]"
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        mx.set((e.clientX - rect.left - rect.width / 2) / rect.width);
        my.set((e.clientY - rect.top - rect.height / 2) / rect.height);
      }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-background">
        {/* Ambient warm glow */}
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 50% 40%, rgba(255,245,220,.55) 0%, rgba(248,247,244,0) 60%)",
          }}
        />

        {/* Parallax paper field — layered depth */}
        <motion.div
          className="absolute inset-0 z-[2]"
          style={{
            opacity: fieldOpacity,
            scale: fieldScale,
            x: useTransform(sx, (v) => v * -50),
            y: useTransform(sy, (v) => v * -35),
          }}
        >
          <PaperField density={110} />
        </motion.div>

        {/* Foreground bokeh — huge blurred sheets for cinematic DOF */}
        <ForegroundBokeh mx={sx} my={sy} />

        {/* Hero typography */}
        <motion.div
          style={{ y: headingY, opacity: headingOpacity }}
          className="relative z-20 h-full max-w-[1400px] mx-auto px-10 pt-32 flex flex-col"
        >
          <div className="flex items-center gap-2 eyebrow">
            <span className="w-1 h-1 rounded-full bg-ink/60" /> AI Hiring OS
          </div>

          <h1 className="display-xl mt-16 text-[64px] md:text-[112px] lg:text-[148px]">
            Finding talent<br />
            shouldn't<br />
            depend on luck.
          </h1>

          <div className="mt-12 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Every resume tells a story.<br />
            We help you understand it.
          </div>

          <a
            href="#act2"
            className="mt-10 inline-flex items-center gap-4 group w-fit"
          >
            <span className="text-[13px] tracking-[0.08em]">Enter Intelligence</span>
            <span className="w-10 h-10 rounded-full border border-ink/30 flex items-center justify-center group-hover:bg-ink group-hover:text-background transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10m0 0L8 3m4 4l-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>

          <div className="mt-auto pb-10 flex items-end justify-between text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>01</span>
              <span className="block w-24 h-px bg-ink/20" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span>Scroll</span>
              <span className="block w-px h-10 bg-ink/20" />
            </div>
          </div>
        </motion.div>

        {/* Floating focus resume */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-[15]"
          style={{
            scale: resumeScale,
            y: resumeY,
            x: useTransform(sx, (v) => v * 40),
            rotateY: useTransform(sx, (v) => v * 10),
            rotateX: useTransform(sy, (v) => v * -8),
          }}
        >
          <div className="translate-x-[10vw] md:translate-x-[18vw]">
            <ResumeObject />
          </div>
        </motion.div>

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-[25]"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 55%, rgba(20,15,5,.18) 100%)",
          }}
        />

        {/* Film grain */}
        <div
          className="absolute inset-0 pointer-events-none z-[26] opacity-[0.06] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        {/* Wash to white as we transition to act 2 (which is dark) */}
        <motion.div
          className="absolute inset-0 bg-background pointer-events-none z-[30]"
          style={{ opacity: whiteWash }}
        />
      </div>
    </section>
  );
}

/* ---------- ACT 02 ---------- */

const RESUME_FRAGMENTS = [
  { label: "Experience", dx: -360, dy: -180, rot: -6, delay: 0 },
  { label: "Projects",   dx:  380, dy: -120, rot:  5, delay: 0.05 },
  { label: "Education",  dx: -300, dy:  180, rot:  4, delay: 0.1 },
  { label: "Skills",     dx:  340, dy:  200, rot: -3, delay: 0.03 },
  { label: "Achievements", dx: 0,  dy: -280, rot:  0, delay: 0.08 },
];

const SKILL_TOKENS = [
  "React", "Python", "Leadership", "Docker", "Node.js", "Communication",
  "AWS", "MongoDB",
];

const PROMPT_TEXT = "Tell me about the most challenging project you've built.";

function TypedPrompt({ progress }: { progress: import("framer-motion").MotionValue<number> }) {
  const chars = useTransform(progress, (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    return PROMPT_TEXT.slice(0, Math.round(clamped * PROMPT_TEXT.length));
  });
  const [text, setText] = useState("");
  useEffect(() => chars.on("change", (v) => setText(v as string)), [chars]);
  return (
    <span>
      {text}
      <span className="inline-block w-[2px] h-[0.9em] align-middle bg-white/70 ml-1 animate-pulse" />
    </span>
  );
}

function ActTwo() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // Camera — subtle zoom & rotation across the entire scene
  const camScale  = useTransform(scrollYProgress, [0, 0.5, 1], [1.02, 1.06, 0.96]);
  const camRotate = useTransform(scrollYProgress, [0, 1], [-0.5, 1.2]);
  const camY      = useTransform(scrollYProgress, [0, 1], [0, -30]);

  // --- Stage 1 : Resume ---
  const resumeOpacity  = useTransform(scrollYProgress, [0, 0.05, 0.28, 0.42], [0.9, 1, 1, 0]);
  const resumeScale    = useTransform(scrollYProgress, [0, 0.12, 0.42], [1.3, 1.4, 0.75]);
  const resumeBlur     = useTransform(scrollYProgress, [0.28, 0.42], [0, 6]);

  // --- Stage 2 : Fragments detach ---
  const fragProgress   = useTransform(scrollYProgress, [0.12, 0.32], [0, 1]);
  const fragOpacity    = useTransform(scrollYProgress, [0.12, 0.18, 0.40, 0.48], [0, 1, 1, 0]);

  // --- Stage 3 : Skills orbit ---
  const skillProgress  = useTransform(scrollYProgress, [0.22, 0.42], [0, 1]);
  const skillOpacity   = useTransform(scrollYProgress, [0.22, 0.30, 0.50, 0.58], [0, 1, 1, 0]);
  const trailOpacity   = useTransform(scrollYProgress, [0.24, 0.32, 0.55, 0.62], [0, 0.6, 0.6, 0]);

  // --- Stage 4 : Interview prompt ---
  const promptOpacity  = useTransform(scrollYProgress, [0.48, 0.54, 0.66, 0.72], [0, 1, 1, 0]);
  const promptType     = useTransform(scrollYProgress, [0.52, 0.66], [0, 1]);

  // --- Stage 5 : Waveform ---
  const waveOpacity    = useTransform(scrollYProgress, [0.68, 0.74, 0.80, 0.86], [0, 1, 1, 0]);

  // --- Stage 6 : Sphere ---
  const sphereOpacity  = useTransform(scrollYProgress, [0.82, 0.88], [0, 1]);
  const sphereScale    = useTransform(scrollYProgress, [0.82, 0.92, 1], [0.5, 1, 0.85]);

  // --- Stage 7 : Score ---
  const scoreOpacity   = useTransform(scrollYProgress, [0.92, 0.97], [0, 1]);
  const scoreScale     = useTransform(scrollYProgress, [0.92, 1], [0.9, 1]);

  // Left rail active step
  const activeStep = useTransform(scrollYProgress, (v) => {
    if (v < 0.22) return 0;
    if (v < 0.48) return 1;
    if (v < 0.82) return 2;
    return 3;
  });
  const [step, setStep] = useState(0);
  useEffect(() => activeStep.on("change", (v) => setStep(v as number)), [activeStep]);

  return (
    <section id="act2" ref={ref} className="relative h-[420vh] bg-ink">
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-ink">
        {/* Environment: fog + faint gradients */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, #12100c 0%, #0a0906 45%, #030303 85%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 55%, rgba(220,200,160,.10), transparent 65%), radial-gradient(ellipse 80% 30% at 50% 100%, rgba(0,0,0,.6), transparent)",
          }}
        />
        <Stars count={140} />
        {/* Volumetric dust */}
        <AmbientDust count={80} />

        {/* Left editorial column — pinned, refined hierarchy */}
        <div className="absolute left-10 md:left-14 top-28 z-30 text-white max-w-[420px]">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase text-white/40">
            <span className="w-1 h-1 rounded-full bg-white/40" /> Intelligence Engine
          </div>
          <h2
            className="mt-10 text-white font-medium"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(40px, 4.4vw, 72px)",
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
            }}
          >
            We read<br />between<br />the lines.
          </h2>
          <p
            className="mt-8 text-white/45"
            style={{
              fontSize: "clamp(22px, 2.2vw, 34px)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            So you don't<br />have to.
          </p>
          <ol className="mt-14 space-y-4 text-[11px] tracking-[0.18em] uppercase text-white/40">
            {["Dissect", "Understand", "Interview", "Rank"].map((t, i) => (
              <li key={t} className="grid grid-cols-[28px_1fr] items-center gap-4">
                <span className={step === i ? "text-white" : "text-white/25"}>
                  0{i + 1}
                </span>
                <span
                  className={`transition-all duration-500 ${
                    step === i ? "text-white tracking-[0.24em]" : "text-white/35"
                  }`}
                >
                  {t}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Center cinematic stage */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ scale: camScale, rotate: camRotate, y: camY }}
        >
          {/* Curved skill trails */}
          <motion.svg
            style={{ opacity: trailOpacity }}
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1000 800"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="neuron" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(220,200,160,0)" />
                <stop offset="50%" stopColor="rgba(220,200,160,.5)" />
                <stop offset="100%" stopColor="rgba(220,200,160,0)" />
              </linearGradient>
            </defs>
            {SKILL_TOKENS.map((_, i) => {
              const a = (i / SKILL_TOKENS.length) * Math.PI * 2 + 0.4;
              const r = 300;
              const x = 500 + Math.cos(a) * r;
              const y = 400 + Math.sin(a) * r * 0.7;
              const cx = 500 + Math.cos(a + 0.6) * 140;
              const cy = 400 + Math.sin(a + 0.6) * 90;
              return (
                <path
                  key={i}
                  d={`M 500 400 Q ${cx} ${cy} ${x} ${y}`}
                  stroke="url(#neuron)"
                  strokeWidth="0.6"
                  fill="none"
                />
              );
            })}
          </motion.svg>

          {/* Resume — hero object */}
          <motion.div
            style={{
              opacity: resumeOpacity,
              scale: resumeScale,
              filter: useTransform(resumeBlur, (b) => `blur(${b}px)`),
            }}
            className="relative z-10"
          >
            <div style={{ transform: "perspective(1400px) rotateY(-8deg) rotateX(4deg)" }}>
              <ResumeObject dark />
            </div>
          </motion.div>

          {/* Fragments detaching from the resume */}
          <motion.div
            style={{ opacity: fragOpacity }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            {RESUME_FRAGMENTS.map((f) => {
              const p = useTransform(fragProgress, (v) => Math.max(0, Math.min(1, v - f.delay)));
              const x = useTransform(p, [0, 1], [0, f.dx]);
              const y = useTransform(p, [0, 1], [0, f.dy]);
              const rot = useTransform(p, [0, 1], [0, f.rot]);
              return (
                <motion.div
                  key={f.label}
                  style={{ x, y, rotate: rot }}
                  className="absolute"
                >
                  <div className="px-4 py-3 rounded-[8px] dark-paper text-white/80 text-[11px] tracking-[0.18em] uppercase min-w-[140px] text-center">
                    {f.label}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Skill tokens orbiting */}
          <motion.div
            style={{ opacity: skillOpacity }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            {SKILL_TOKENS.map((tok, i) => {
              const angle = (i / SKILL_TOKENS.length) * Math.PI * 2 + 0.4;
              const rTarget = 300 + (i % 3) * 24;
              const p = useTransform(skillProgress, (v) => Math.max(0, Math.min(1, v)));
              const rNow = useTransform(p, [0, 1], [40, rTarget]);
              const x = useTransform(rNow, (r) => Math.cos(angle) * r);
              const y = useTransform(rNow, (r) => Math.sin(angle) * r * 0.7);
              const op = useTransform(p, [0, 0.2, 1], [0, 1, 1]);
              return (
                <motion.div
                  key={tok}
                  style={{ x, y, opacity: op }}
                  className="absolute text-[11px] tracking-wide text-white/80 px-3 py-1 rounded-full border border-white/15 backdrop-blur-sm bg-white/[0.03]"
                >
                  {tok}
                </motion.div>
              );
            })}
          </motion.div>

          {/* Interview prompt */}
          <motion.div
            style={{ opacity: promptOpacity }}
            className="absolute z-20 text-center text-white max-w-[900px] px-8"
          >
            <div className="eyebrow !text-white/40 mb-8">The Question</div>
            <div
              className="text-white/95 font-normal"
              style={{
                fontSize: "clamp(28px, 3.4vw, 52px)",
                lineHeight: 1.18,
                letterSpacing: "-0.02em",
              }}
            >
              "<TypedPrompt progress={promptType} />"
            </div>
          </motion.div>

          {/* Waveform */}
          <motion.div
            style={{ opacity: waveOpacity }}
            className="absolute z-20 flex items-center justify-center gap-[3px] h-32"
          >
            {Array.from({ length: 56 }).map((_, i) => (
              <span
                key={i}
                className="w-[2px] rounded-full"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(220,200,160,.3), #fff, rgba(220,200,160,.3))",
                  height: `${14 + Math.abs(Math.sin(i * 0.42)) * 90}px`,
                  animation: `wave 1.${i % 9}s ease-in-out infinite`,
                  animationDelay: `${i * 0.025}s`,
                }}
              />
            ))}
          </motion.div>

          {/* Sphere — intelligence core */}
          <motion.div
            style={{ opacity: sphereOpacity, scale: sphereScale }}
            className="absolute z-10"
          >
            <Sphere />
          </motion.div>

          {/* Score emerging from the sphere */}
          <motion.div
            style={{ opacity: scoreOpacity, scale: scoreScale }}
            className="absolute z-30 flex flex-col items-center text-white"
          >
            <div className="eyebrow !text-white/40 mb-4">Overall Score</div>
            <div
              className="font-serif text-white leading-none"
              style={{
                fontSize: "clamp(160px, 20vw, 280px)",
                fontWeight: 300,
                letterSpacing: "-0.04em",
                textShadow: "0 0 60px rgba(220,200,160,.35)",
              }}
            >
              92
            </div>
            <div className="text-[13px] tracking-[0.24em] uppercase text-white/50 mt-6">Ready</div>
          </motion.div>
        </motion.div>

        {/* Bottom rail */}
        <div className="absolute bottom-8 left-10 right-10 z-30 flex items-center justify-between text-[11px] tracking-[0.22em] uppercase text-white/35">
          <div className="flex items-center gap-4">
            <span>02</span>
            <span className="block w-24 h-px bg-white/15" />
          </div>
          <span>Intelligence in motion</span>
        </div>
      </div>
    </section>
  );
}

function AmbientDust({ count = 60 }: { count?: number }) {
  const dust = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const r = (n: number) => (Math.sin(i * 1301 + n * 4297) + 1) / 2;
        return {
          x: r(1) * 100,
          y: r(2) * 100,
          s: r(3) * 1.4 + 0.4,
          o: r(4) * 0.4 + 0.1,
          d: r(5) * 10 + 8,
          del: r(6) * 6,
          hue: r(7) > 0.6,
        };
      }),
    [count]
  );
  return (
    <div className="absolute inset-0 pointer-events-none">
      {dust.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            opacity: p.o,
            background: p.hue ? "rgba(220,200,160,.85)" : "rgba(255,255,255,.7)",
            boxShadow: p.hue ? "0 0 4px rgba(220,200,160,.5)" : "none",
            animation: `float-y ${p.d}s ease-in-out ${p.del}s infinite`,
          }}
        />
      ))}
    </div>
  );
}



function Stars({ count = 100 }: { count?: number }) {
  const pts = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const r = (n: number) => (Math.sin(i * 9301 + n * 49297) + 1) / 2;
        return {
          x: r(1) * 100,
          y: r(2) * 100,
          s: r(3) * 1.6 + 0.3,
          o: r(4) * 0.6 + 0.1,
          d: r(5) * 4 + 2,
          del: r(6) * 3,
        };
      }),
    [count]
  );
  return (
    <div className="absolute inset-0">
      {pts.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            opacity: p.o,
            animation: `float-y ${p.d}s ease-in-out ${p.del}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function ConnectionWeb() {
  // Hairline SVG connections radiating out
  const lines = useMemo(() => {
    return Array.from({ length: 28 }).map((_, i) => {
      const a = (i / 28) * Math.PI * 2;
      const r = 280 + ((i * 37) % 80);
      return {
        x2: 50 + (Math.cos(a) * r) / 12,
        y2: 50 + (Math.sin(a) * r) / 12,
      };
    });
  }, []);
  return (
    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <radialGradient id="fadeline" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      {lines.map((l, i) => (
        <line
          key={i}
          x1="50"
          y1="50"
          x2={l.x2}
          y2={l.y2}
          stroke="url(#fadeline)"
          strokeWidth="0.08"
        />
      ))}
    </svg>
  );
}

function Sphere({ small = false }: { small?: boolean }) {
  const size = small ? 180 : 280;
  return (
    <div
      className="relative rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 35% 30%, #fff 0%, #e8dcc0 18%, #b8a079 45%, #2a2418 75%, #050505 100%)",
        boxShadow:
          "0 0 80px 10px rgba(220,200,160,.35), 0 0 160px 40px rgba(220,200,160,.15), inset 0 0 60px rgba(0,0,0,.6)",
        animation: "pulse-glow 4s ease-in-out infinite",
      }}
    >
      <div
        className="absolute inset-0 rounded-full mix-blend-overlay opacity-60"
        style={{
          background:
            "radial-gradient(circle at 65% 70%, rgba(255,255,255,.4), transparent 40%)",
        }}
      />
      {/* Tiny orbiting particles */}
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-white/80"
          style={{
            transformOrigin: "0 0",
            animation: `orbit ${8 + i}s linear infinite`,
            ["--rad" as never]: `${size / 2 + 20 + i * 4}px`,
            animationDelay: `${-i * 0.6}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- ACT 03 ---------- */

function ParticleStream({ dir = "l" }: { dir?: "l" | "r" }) {
  // A thin stream of particles flowing between sphere and destination.
  const count = 22;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const delay = (i / count) * 4;
        const y = 50 + Math.sin(i * 1.3) * 22; // gentle sine curve, %
        const size = 1 + (i % 4) * 0.5;
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: dir === "l" ? "0%" : "100%",
              top: `${y}%`,
              width: size,
              height: size,
              background: "rgba(184,160,121,.9)",
              boxShadow: "0 0 6px rgba(220,200,160,.7)",
              animation: `${dir === "l" ? "stream" : "stream-r"} 4.5s linear infinite`,
              animationDelay: `-${delay}s`,
              ["--to" as never]: dir === "l" ? "100%" : "-100%",
            }}
          />
        );
      })}
    </div>
  );
}

function IntelligenceCore() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 520, height: 520 }}>
      {/* Volumetric halos */}
      <div
        className="absolute rounded-full"
        style={{
          width: 520, height: 520,
          background: "radial-gradient(circle, rgba(220,200,160,.18) 0%, rgba(220,200,160,.06) 40%, transparent 70%)",
          animation: "halo 7s ease-in-out infinite",
          filter: "blur(20px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 360, height: 360,
          background: "radial-gradient(circle, rgba(220,200,160,.35) 0%, transparent 65%)",
          animation: "halo 5s ease-in-out infinite",
          filter: "blur(10px)",
        }}
      />
      {/* Slow rotating dust ring */}
      <div
        className="absolute rounded-full"
        style={{
          width: 440, height: 440,
          border: "1px solid rgba(184,160,121,.18)",
          animation: "spin-slow 40s linear infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 320, height: 320,
          border: "1px dashed rgba(184,160,121,.14)",
          animation: "spin-slow 60s linear infinite reverse",
        }}
      />

      {/* The sphere */}
      <div
        className="relative rounded-full"
        style={{
          width: 260, height: 260,
          background:
            "radial-gradient(circle at 32% 28%, #fffefb 0%, #f4e9d0 12%, #d4bd91 34%, #7a6544 62%, #1a1509 85%, #050505 100%)",
          boxShadow:
            "0 0 100px 20px rgba(220,200,160,.35), 0 0 200px 60px rgba(220,200,160,.18), inset 0 0 80px rgba(0,0,0,.7)",
          animation: "breathe 6s ease-in-out infinite",
        }}
      >
        <div
          className="absolute inset-0 rounded-full mix-blend-overlay opacity-70"
          style={{
            background: "radial-gradient(circle at 68% 74%, rgba(255,255,255,.5), transparent 42%)",
          }}
        />
        {/* Orbiting dust */}
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full bg-white/80"
            style={{
              width: i % 3 === 0 ? 2 : 1,
              height: i % 3 === 0 ? 2 : 1,
              transformOrigin: "0 0",
              animation: `orbit ${10 + i * 0.8}s linear infinite`,
              ["--rad" as never]: `${140 + (i % 5) * 12}px`,
              animationDelay: `-${i * 0.7}s`,
              boxShadow: "0 0 4px rgba(220,200,160,.8)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ActThree() {
  return (
    <section id="act3" className="relative bg-background overflow-hidden">
      {/* Atmospheric fog */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(220,200,160,.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(0,0,0,.04), transparent 60%)",
        }}
      />

      {/* Huge faded background wordmark */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-[38vh] flex items-center justify-center pointer-events-none select-none"
      >
        <span
          className="display-xl text-ink whitespace-nowrap"
          style={{ fontSize: "clamp(220px, 32vw, 520px)", opacity: 0.04, letterSpacing: "-0.05em" }}
        >
          Hirely.ai
        </span>
      </div>

      {/* Ambient drifting particles */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => {
          const seed = i * 131 + 7;
          const r = (n: number) => ((Math.sin(seed * n) + 1) / 2);
          return (
            <span
              key={i}
              className="absolute rounded-full bg-ink/30"
              style={{
                left: `${r(1.1) * 100}%`,
                top: `${r(2.3) * 100}%`,
                width: 1 + r(3.1) * 1.5,
                height: 1 + r(3.1) * 1.5,
                animation: `float-y ${14 + r(4.2) * 14}s ease-in-out infinite`,
                animationDelay: `-${r(5.5) * 10}s`,
                opacity: 0.15 + r(6.6) * 0.35,
              }}
            />
          );
        })}
      </div>

      <div className="relative flex flex-col">
        {/* Editorial headline — restrained, breathing */}
        <div className="relative z-20 pt-32 pb-20 text-center px-8">
          <div className="eyebrow inline-flex items-center gap-2 justify-center">
            <span className="w-1 h-1 rounded-full bg-ink/60" /> The Decision
          </div>
          <h2
            className="mt-10 text-ink mx-auto"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(26px, 3vw, 44px)",
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
              fontWeight: 500,
              maxWidth: 780,
            }}
          >
            One intelligence.
            <br />
            <span className="text-ink/50">Two perspectives.</span>
          </h2>
          <div
            className="mt-6 text-muted-foreground mx-auto"
            style={{ fontSize: "13px", letterSpacing: "0.22em", textTransform: "uppercase" }}
          >
            Choose your path
          </div>
        </div>

        {/* Composition */}
        <div className="relative z-10 grid grid-cols-[1fr_minmax(320px,auto)_1fr] items-center gap-0 px-6 md:px-16 pb-32 min-h-[640px]">
          {/* ------ CANDIDATE (left) ------ */}
          <a href="/portal" className="group relative flex flex-col items-center">
            <div className="mb-8 eyebrow opacity-70">For Candidates</div>

            {/* Floating resume with 3D tilt */}
            <div
              className="relative transition-all duration-700 will-change-transform group-hover:[transform:perspective(1400px)_rotateY(-4deg)_rotateX(3deg)_translateY(-6px)]"
              style={{
                animation: "float-tilt 8s ease-in-out infinite",
                filter: "drop-shadow(0 40px 60px rgba(40,30,10,.18))",
              }}
            >
              <div style={{ transform: "scale(1.15)" }}>
                <ResumeObject />
              </div>
            </div>

            {/* Trail of particles flowing toward sphere */}
            <div className="absolute inset-y-0 right-0 w-[55%] pointer-events-none">
              <ParticleStream dir="l" />
            </div>

            <div className="mt-14 flex flex-col items-center gap-2 text-ink">
              <div
                className="font-medium tracking-tight"
                style={{ fontSize: "clamp(20px, 1.6vw, 26px)", letterSpacing: "-0.02em" }}
              >
                Candidate
              </div>
              <div className="text-[12px] text-muted-foreground text-center max-w-[220px] leading-relaxed">
                Ace interviews. Improve your resume. Get hired faster.
              </div>
              <div className="mt-4 inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase">
                <span>Enter</span>
                <span className="w-8 h-px bg-ink transition-all group-hover:w-16" />
                <span>→</span>
              </div>
            </div>
          </a>

          {/* ------ SPHERE (center) ------ */}
          <div className="relative flex justify-center items-center self-center">
            <IntelligenceCore />
          </div>

          {/* ------ RECRUITER (right) ------ */}
          <a href="/portal" className="group relative flex flex-col items-center">
            <div className="mb-8 eyebrow opacity-70">For Recruiters</div>

            <div
              className="relative will-change-transform"
              style={{ animation: "float-tilt-r 9s ease-in-out infinite" }}
            >
              <RecruiterCluster />
            </div>

            {/* Trail of particles flowing from sphere */}
            <div className="absolute inset-y-0 left-0 w-[55%] pointer-events-none">
              <ParticleStream dir="r" />
            </div>

            <div className="mt-14 flex flex-col items-center gap-2 text-ink">
              <div
                className="font-medium tracking-tight"
                style={{ fontSize: "clamp(20px, 1.6vw, 26px)", letterSpacing: "-0.02em" }}
              >
                Recruiter
              </div>
              <div className="text-[12px] text-muted-foreground text-center max-w-[220px] leading-relaxed">
                Screen smarter. Rank accurately. Hire the best.
              </div>
              <div className="mt-4 inline-flex items-center gap-3 text-[11px] tracking-[0.18em] uppercase">
                <span>Enter</span>
                <span className="w-8 h-px bg-ink transition-all group-hover:w-16" />
                <span>→</span>
              </div>
            </div>
          </a>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-3 pb-16 text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
          <span className="block w-px h-10 bg-ink/20" />
          <a href="#" className="hover:text-ink transition-colors">See it in action ↗</a>
        </div>

        {/* Footer */}
        <footer className="relative z-10 border-t border-ink/10 px-10 py-8 flex flex-wrap items-center justify-between gap-4 text-[12px] text-muted-foreground">
          <div className="text-ink">
            Hirely.ai<span className="text-champagne">*</span>
          </div>
          <div>© 2026 Hirely.ai. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-ink transition-colors">Privacy</a>
            <a href="#" className="hover:text-ink transition-colors">Terms</a>
            <a href="#" className="hover:text-ink transition-colors">LinkedIn</a>
          </div>
        </footer>
      </div>
    </section>
  );
}

function RecruiterCluster() {
  const candidates = [
    { name: "Aaryan Garg", score: "92%", label: "Strong match", tx: -18, ty: 0,   rz: -4 },
    { name: "Riya Sharma", score: "89%", label: "Solid match",  tx: 14,  ty: 90,  rz: 2.5 },
    { name: "Karan Verma", score: "86%", label: "Good match",   tx: -6,  ty: 180, rz: -1.5 },
  ];
  return (
    <div className="w-[320px] md:w-[360px] h-[300px] relative" style={{ perspective: "1400px" }}>
      {candidates.map((c, i) => (
        <div
          key={c.name}
          className="paper-card absolute left-0 right-0 rounded-[12px] p-4 flex items-center justify-between transition-all duration-700"
          style={{
            top: 0,
            ["--tx" as never]: `${c.tx}px`,
            ["--ty" as never]: `${c.ty}px`,
            ["--rz" as never]: `${c.rz}deg`,
            animation: `card-drift ${7 + i * 1.4}s ease-in-out infinite`,
            animationDelay: `-${i * 0.9}s`,
            zIndex: 10 - i,
            boxShadow:
              "0 30px 60px -25px rgba(40,30,10,.25), 0 10px 30px -15px rgba(40,30,10,.15)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-ink/10" />
            <div>
              <div className="text-[12px] font-medium text-ink">{c.name}</div>
              <div className="text-[10px] text-muted-foreground">{c.label}</div>
            </div>
          </div>
          <div className="text-[14px] font-medium text-ink tabular-nums">{c.score}</div>
        </div>
      ))}
    </div>
  );
}


/* ---------- Page ---------- */

function HirelyAI() {
  // Smooth scroll feel via CSS
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return (
    <main className="relative">
      <Nav />
      <ActOne />
      <ActTwo />
      <ActThree />
    </main>
  );
}
