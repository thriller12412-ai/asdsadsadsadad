import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Choose Your Path — Hirely.ai" },
      {
        name: "description",
        content:
          "Two perspectives. One intelligence. Enter Hirely.ai as a candidate or recruiter.",
      },
      { property: "og:title", content: "Choose Your Path — Hirely.ai" },
      {
        property: "og:description",
        content:
          "Two perspectives. One intelligence. Enter Hirely.ai as a candidate or recruiter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalPage,
});

type Side = "candidate" | "recruiter" | null;

function PortalPage() {
  // Continuous bias in [-1, 1]. Negative = left (candidate), positive = right (recruiter).
  const [bias, setBias] = useState(0);
  const [side, setSide] = useState<Side>(null);
  const [entering, setEntering] = useState<Side>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const navigate = useNavigate();

  // Cursor + bias tracking
  useEffect(() => {
    const el = cursorRef.current;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let b = 0;
    let bTarget = 0;
    const deadzone = 0.06; // small neutral band around center

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const cx = window.innerWidth / 2;
      const raw = (e.clientX - cx) / cx; // -1 .. 1
      // Ease outward from deadzone
      let mapped = 0;
      if (raw > deadzone) mapped = (raw - deadzone) / (1 - deadzone);
      else if (raw < -deadzone) mapped = (raw + deadzone) / (1 - deadzone);
      // Amplify + clamp
      bTarget = Math.max(-1, Math.min(1, mapped * 1.15));
    };

    const onLeave = () => {
      bTarget = 0;
    };

    const tick = () => {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      b += (bTarget - b) * 0.08;
      if (el) {
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
      setBias(b);
      // Determine committed side after threshold
      if (b < -0.28) setSide("candidate");
      else if (b > 0.28) setSide("recruiter");
      else setSide(null);
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleEnter = async () => {
    if (entering || !side) return;
    setEntering(side);
    const dest = side === "candidate" ? "/candidate" : "/recruiter";
    const { mockLogin } = await import("@/lib/auth.functions");
    await mockLogin({ data: { email: `${side}@hirely.ai.com`, role: side } });
    window.setTimeout(() => navigate({ to: dest }), 1100);
  };

  // Derived numbers
  const leftLean = Math.max(0, -bias); // 0..1
  const rightLean = Math.max(0, bias); // 0..1
  const activeLean = Math.max(leftLean, rightLean);

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-background text-ink select-none"
      style={{ cursor: "none" }}
      onClick={handleEnter}
    >
      {/* Custom cursor */}
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] hidden md:flex items-center justify-center rounded-full transition-[width,height,background,color] duration-500 ease-out"
        style={{
          width: side ? 108 : 10,
          height: side ? 108 : 10,
          background:
            side === "recruiter"
              ? "var(--color-champagne)"
              : "var(--color-ink)",
          color:
            side === "recruiter"
              ? "var(--color-ink)"
              : "var(--color-background)",
          mixBlendMode: side ? "normal" : "difference",
          fontSize: 11,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {side ? "Enter" : null}
      </div>

      {/* Grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.05] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.9) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* ---------- LEFT HALF (Candidate) ---------- */}
      <Half
        role="candidate"
        bias={bias}
        active={side === "candidate"}
        entering={entering}
      />

      {/* ---------- RIGHT HALF (Recruiter) ---------- */}
      <Half
        role="recruiter"
        bias={bias}
        active={side === "recruiter"}
        entering={entering}
      />

      {/* Floating particles (global) */}
      <Particles bias={bias} />

      {/* Oversized wordmark that parallax-shifts with bias */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[4] flex items-center justify-center overflow-hidden"
      >
        <span
          className="select-none whitespace-nowrap"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(320px, 44vw, 760px)",
            letterSpacing: "-0.06em",
            lineHeight: 1,
            color: "var(--color-ink)",
            opacity: 0.03 + activeLean * 0.02,
            fontWeight: 500,
            transform: `translate3d(${bias * -40}px, 6vh, 0)`,
            transition: "opacity 500ms ease-out",
          }}
        >
          hirely.ai
        </span>
      </div>

      {/* Central hairline that shifts with cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[20%] bottom-[16%] w-px z-[10]"
        style={{
          left: `${50 + bias * 6}%`,
          background:
            "linear-gradient(to bottom, transparent, rgba(0,0,0,0.14), transparent)",
          opacity: 1 - activeLean * 0.75,
          transform: `scaleY(${1 - activeLean * 0.3})`,
          transformOrigin: "center",
          transition: "opacity 300ms ease-out",
        }}
      />

      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-8 md:px-14 py-8 pointer-events-none">
        <Link
          to="/"
          className="pointer-events-auto flex items-center gap-2 text-[13px] tracking-tight text-ink"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-medium">Hirely.ai</span>
          <span className="text-champagne">*</span>
        </Link>
        <Link
          to="/"
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-ink transition-colors"
        >
          <span className="w-6 h-px bg-current transition-all group-hover:w-10" />
          Back
        </Link>
      </nav>

      {/* Central editorial question — sits at top, fades fast as user leans */}
      <div
        className="absolute z-30 left-1/2 -translate-x-1/2 top-[9vh] text-center px-6 pointer-events-none w-full max-w-[720px]"
        style={{
          opacity: Math.max(0, 1 - activeLean * 2.2) * (entering ? 0 : 1),
          transform: `translate(-50%, ${activeLean * -12}px)`,
          transition: "opacity 220ms ease-out",
        }}
      >
        <div className="eyebrow inline-flex items-center gap-2 justify-center">
          <span className="w-1 h-1 rounded-full bg-ink/60" /> The Portal
        </div>
        <h1
          className="mt-5 text-ink mx-auto whitespace-nowrap"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(36px, 4.8vw, 76px)",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            fontWeight: 500,
          }}
        >
          Who are you <span className="text-ink/45">today?</span>
        </h1>
        <div
          className="mt-5 text-[10px] uppercase tracking-[0.32em] text-muted-foreground"
        >
          Move your cursor · Choose a world
        </div>
      </div>


      {/* Bottom rail */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 px-8 md:px-14 pb-8 flex items-end justify-between text-[11px] uppercase tracking-[0.22em] text-muted-foreground pointer-events-none"
        style={{ opacity: entering ? 0 : 1, transition: "opacity 500ms" }}
      >
        <span>One intelligence · Two perspectives</span>
        <span>© 2026 Hirely.ai</span>
      </div>

      {/* Enter transition wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[90] transition-all duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          background:
            entering === "recruiter"
              ? "radial-gradient(circle at 75% 55%, color-mix(in oklab, var(--color-champagne) 45%, var(--color-background)), var(--color-background) 70%)"
              : "var(--color-background)",
          opacity: entering ? 1 : 0,
          transform: entering ? "scale(1)" : "scale(1.02)",
        }}
      />
    </main>
  );
}

/* --------------------------------------------------------
   HALF — the entire side IS the button. No borders, no card.
   Uses continuous `bias` to expand/dim/blur.
-------------------------------------------------------- */
function Half({
  role,
  bias,
  active,
  entering,
}: {
  role: "candidate" | "recruiter";
  bias: number;
  active: boolean;
  entering: Side;
}) {
  const isLeft = role === "candidate";
  const lean = isLeft ? Math.max(0, -bias) : Math.max(0, bias); // 0..1 toward this side
  const away = isLeft ? Math.max(0, bias) : Math.max(0, -bias); // 0..1 away from this side

  const isEntering = entering === role;
  const isExiting = entering && entering !== role;

  // Each half is absolutely positioned and its width grows with lean.
  const baseWidth = 50; // %
  const widthPct = baseWidth + lean * 8 - away * 6; // 44..58

  return (
    <div
      aria-hidden={false}
      className="absolute top-0 h-full overflow-hidden"
      style={{
        left: isLeft ? 0 : `${100 - widthPct}%`,
        width: `${widthPct}%`,
        transition: "width 700ms cubic-bezier(0.22,1,0.36,1), left 700ms cubic-bezier(0.22,1,0.36,1)",
        zIndex: 5,
      }}
    >
      {/* Background wash */}
      <div
        className="absolute inset-0 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          background: isLeft
            ? `radial-gradient(90% 80% at ${30 + lean * 10}% 55%, color-mix(in oklab, var(--color-fog) ${
                60 + lean * 40
              }%, transparent), transparent 72%)`
            : `radial-gradient(90% 80% at ${70 - lean * 10}% 55%, color-mix(in oklab, var(--color-champagne) ${
                18 + lean * 30
              }%, transparent), transparent 72%)`,
          opacity: 0.4 + lean * 0.6,
          transform: isEntering ? "scale(1.2)" : `scale(${1 + lean * 0.04})`,
        }}
      />

      {/* Vertical vignette that "recedes" when away */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isLeft
            ? "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 100%)"
            : "linear-gradient(to left, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 100%)",
          opacity: away * 0.9,
          transition: "opacity 500ms",
        }}
      />

      {/* Immersive per-side visuals */}
      <SideVisual role={role} lean={lean} entering={isEntering} />

      {/* Content layer */}
      <div
        className="relative z-10 h-full w-full flex flex-col justify-center transition-[transform,opacity,filter] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          padding: "28vh 5vw 12vh",
          alignItems: isLeft ? "flex-start" : "flex-end",
          textAlign: isLeft ? "left" : "right",
          transform: isEntering
            ? "scale(1.08)"
            : `translateY(${-lean * 8}px)`,
          opacity: isExiting ? 0.08 : 0.55 + lean * 0.45 - away * 0.35,
          filter: away > 0.15 ? `blur(${away * 3}px) saturate(${1 - away * 0.4})` : "none",
        }}
      >
        <div
          className="eyebrow transition-colors duration-500"
          style={{ color: active ? "var(--color-ink)" : undefined }}
        >
          For
        </div>
        <div
          className="mt-5 text-ink"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(56px, 7.2vw, 132px)",
            letterSpacing: "-0.045em",
            lineHeight: 0.92,
            fontWeight: 500,
            maxWidth: "9ch",
            transform: `translateX(${(isLeft ? -1 : 1) * lean * 10}px)`,
            transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {isLeft ? "Candidate" : "Recruiter"}
        </div>


        <div
          className="mt-10 space-y-1 text-ink/70"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(20px, 1.8vw, 30px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: active ? "var(--color-ink)" : undefined,
            transition: "color 500ms",
          }}
        >
          {(isLeft
            ? ["Prepare.", "Practice.", "Get hired."]
            : ["Screen.", "Rank.", "Hire."]
          ).map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>

        {/* Enter marker — appears when leaning in */}
        <div
          className="mt-14 inline-flex items-center gap-4 text-[11px] uppercase tracking-[0.24em] text-ink"
          style={{
            flexDirection: isLeft ? "row" : "row-reverse",
            opacity: active ? 1 : lean * 0.6,
            transform: `translateX(${(isLeft ? 1 : -1) * (active ? 0 : (1 - lean) * -12)}px)`,
            transition: "opacity 400ms, transform 400ms",
          }}
        >
          <span
            className="h-px bg-ink transition-all duration-500"
            style={{ width: 40 + lean * 80 }}
          />
          <span>{isLeft ? "Enter →" : "← Enter"}</span>
        </div>
      </div>
    </div>
  );
}

/* Per-side ambient visuals that emerge with `lean` (0..1) */
function SideVisual({
  role,
  lean,
  entering,
}: {
  role: "candidate" | "recruiter";
  lean: number;
  entering: boolean;
}) {
  const visible = lean > 0.02 || entering;
  const scale = 0.92 + lean * 0.12;

  if (role === "candidate") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{
          opacity: visible ? Math.min(1, lean * 1.3) : 0,
          transform: `scale(${scale})`,
          transition: "opacity 500ms ease-out, transform 700ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Ghosted resume drifting into view */}
        <div
          style={{
            width: 340,
            height: 460,
            transform: `perspective(1600px) rotateY(${8 - lean * 4}deg) rotateX(${2 + lean * 2}deg) translateX(${8 + lean * 2}vw) translateY(${4 - lean * 4}vh)`,
            transition: "transform 900ms cubic-bezier(0.22,1,0.36,1)",
            animation: "float-tilt 9s ease-in-out infinite",
          }}
        >
          <div
            className="absolute inset-0 rounded-[18px] border"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.72))",
              borderColor: "rgba(0,0,0,0.06)",
              boxShadow: "0 80px 120px -40px rgba(40,30,10,0.32)",
            }}
          />
          <div className="absolute inset-0 p-7 flex flex-col gap-3">
            <div className="h-3 w-28 rounded-full bg-ink/20" />
            <div className="h-2 w-44 rounded-full bg-ink/10" />
            <div className="mt-6 h-1.5 w-full rounded-full bg-ink/10" />
            <div className="h-1.5 w-4/5 rounded-full bg-ink/10" />
            <div className="h-1.5 w-3/5 rounded-full bg-ink/10" />
            <div className="mt-6 h-1.5 w-full rounded-full bg-ink/10" />
            <div className="h-1.5 w-2/3 rounded-full bg-ink/10" />
            <div className="mt-auto flex gap-1.5">
              {["React", "Node", "AWS"].map((s) => (
                <span
                  key={s}
                  className="text-[9px] px-1.5 py-0.5 rounded border border-ink/10 text-ink/60"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Magnetic particles drifting toward the resume */}
        {Array.from({ length: 18 }).map((_, i) => {
          const s = (Math.sin(i * 12.9898) + 1) / 2;
          const t = (Math.sin(i * 78.233) + 1) / 2;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-ink/50"
              style={{
                left: `${20 + s * 60}%`,
                top: `${18 + t * 64}%`,
                width: 1.5 + s * 1.5,
                height: 1.5 + s * 1.5,
                animation: `float-y ${5 + s * 6}s ease-in-out infinite`,
                animationDelay: `-${t * 6}s`,
                opacity: 0.35 + lean * 0.4,
              }}
            />
          );
        })}
      </div>
    );
  }

  // Recruiter — sphere + floating ranking nodes
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        opacity: visible ? Math.min(1, lean * 1.3) : 0,
        transform: `scale(${scale})`,
        transition: "opacity 500ms ease-out, transform 700ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* Sphere */}
      <div
        className="absolute rounded-full"
        style={{
          width: 420,
          height: 420,
          left: `${8 - lean * 2}vw`,
          top: "50%",
          transform: `translateY(-50%) scale(${0.9 + lean * 0.15})`,
          transition: "transform 900ms cubic-bezier(0.22,1,0.36,1), left 700ms",
          background:
            "radial-gradient(circle at 40% 35%, color-mix(in oklab, var(--color-champagne) 90%, white) 0%, color-mix(in oklab, var(--color-champagne) 55%, black) 55%, rgba(20,15,5,0.92) 100%)",
          boxShadow:
            "0 0 160px 30px color-mix(in oklab, var(--color-champagne) 32%, transparent)",
          animation: "breathe 6s ease-in-out infinite",
        }}
      />
      {/* Halo rings */}
      {[560, 720].map((size, i) => (
        <div
          key={size}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            left: `${8 - lean * 2}vw`,
            top: "50%",
            transform: "translateY(-50%)",
            border: "1px solid rgba(0,0,0,0.05)",
            animation: `spin-slow ${40 + i * 20}s linear infinite`,
          }}
        />
      ))}

      {/* Ranking nodes on the right */}
      {[
        { top: "24%", right: "8%",  w: 200, label: "Aaryan Garg",  score: "92", tag: "Strong match" },
        { top: "46%", right: "4%",  w: 220, label: "Riya Sharma",  score: "89", tag: "Solid match"  },
        { top: "68%", right: "10%", w: 190, label: "Karan Verma",  score: "86", tag: "Good match"   },
      ].map((n, i) => (
        <div
          key={n.label}
          className="absolute rounded-[12px] px-4 py-3 flex items-center justify-between gap-3"
          style={{
            top: n.top,
            right: n.right,
            width: n.w,
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 30px 60px -25px rgba(40,30,10,0.28)",
            animation: `card-drift ${6 + i}s ease-in-out infinite`,
            animationDelay: `-${i * 0.7}s`,
            transform: `translateX(${(1 - lean) * 30}px)`,
            transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-ink/15" />
            <div className="leading-tight">
              <div className="text-[11px] text-ink font-medium">{n.label}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">
                {n.tag}
              </div>
            </div>
          </div>
          <div className="text-[13px] text-ink tabular-nums font-medium">{n.score}%</div>
        </div>
      ))}

      {/* Neuron-like connection lines from sphere → cards */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <g
          stroke="rgba(0,0,0,0.14)"
          strokeWidth="0.06"
          fill="none"
          style={{ opacity: lean }}
        >
          <path d="M 22 50 Q 55 32 82 26" />
          <path d="M 22 50 Q 55 50 84 48" />
          <path d="M 22 50 Q 55 68 82 72" />
        </g>
      </svg>
    </div>
  );
}

function Particles({ bias }: { bias: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
      {Array.from({ length: 48 }).map((_, i) => {
        const seed = i * 131 + 7;
        const r = (n: number) => ((Math.sin(seed * n) + 1) / 2);
        // Particles drift horizontally with bias
        const drift = bias * (r(2.9) * 30 + 10);
        return (
          <span
            key={i}
            className="absolute rounded-full bg-ink/30"
            style={{
              left: `calc(${r(1.1) * 100}% + ${drift}px)`,
              top: `${r(2.3) * 100}%`,
              width: 1 + r(3.1) * 1.6,
              height: 1 + r(3.1) * 1.6,
              animation: `float-y ${16 + r(4.2) * 14}s ease-in-out infinite`,
              animationDelay: `-${r(5.5) * 10}s`,
              opacity: 0.12 + r(6.6) * 0.3,
              transition: "left 600ms ease-out",
            }}
          />
        );
      })}
    </div>
  );
}
