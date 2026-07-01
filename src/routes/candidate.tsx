import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { mockLogout } from "@/lib/auth.functions";

export const Route = createFileRoute("/candidate")({
  component: CandidateLayout,
});

const STEPS = [
  { key: "upload", label: "Upload", match: (p: string) => p === "/candidate" },
  { key: "prepare", label: "Prepare", match: (p: string) => p.startsWith("/candidate/prepare") },
  { key: "interview", label: "Interview", match: (p: string) => p.startsWith("/candidate/interview") },
  { key: "report", label: "Report", match: (p: string) => p.startsWith("/candidate/report") },
  { key: "improve", label: "Improve", match: (p: string) => p.startsWith("/candidate/improve") },
];

function CandidateLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/portal" });
  }, [loading, user, nav]);

  const activeIdx = useMemo(() => STEPS.findIndex(s => s.match(pathname)), [pathname]);
  const hideRail = pathname.startsWith("/candidate/interview") || pathname.startsWith("/candidate/history") || pathname.startsWith("/candidate/profile");

  return (
    <div className="min-h-screen bg-background text-ink relative overflow-x-hidden">
      <header className="fixed top-5 left-1/2 -translate-x-1/2 z-50">
        <nav className="glass-panel rounded-full px-5 py-2.5 flex items-center gap-5">
          <Link to="/" className="text-[13px] tracking-tight font-medium">
            Hirely.ai<span className="text-muted-foreground">.</span>
          </Link>
          <span className="w-px h-3 bg-black/10" />
          <ul className="flex items-center gap-4 text-[11.5px] tracking-wide">
            <li><Link to="/candidate" className={linkCls(pathname === "/candidate")}>Studio</Link></li>
            <li><Link to="/candidate/history" className={linkCls(pathname.startsWith("/candidate/history"))}>Progress</Link></li>
            <li><Link to="/candidate/profile" className={linkCls(pathname.startsWith("/candidate/profile"))}>Profile</Link></li>
          </ul>
          <span className="w-px h-3 bg-black/10" />
          <button
            onClick={async () => { await mockLogout(); window.location.href = "/"; }}
            className="text-[11.5px] tracking-wide text-muted-foreground hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </nav>
      </header>

      {!hideRail && activeIdx >= 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="flex items-center gap-3 text-[10px] tracking-[.28em] uppercase text-muted-foreground">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3">
                <span className={"transition-colors " + (i <= activeIdx ? "text-ink" : "")}>
                  <span className="opacity-60 mr-1">0{i + 1}</span>{s.label}
                </span>
                {i < STEPS.length - 1 && <span className={"w-8 h-px " + (i < activeIdx ? "bg-ink" : "bg-black/15")} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.035] mix-blend-multiply"
        style={{ backgroundImage: "radial-gradient(rgba(0,0,0,.7) 1px, transparent 1px)", backgroundSize: "3px 3px" }}
      />

      {!user && !loading ? null : <Outlet />}
    </div>
  );
}

function linkCls(active: boolean) {
  return "transition-colors " + (active ? "text-ink" : "text-muted-foreground hover:text-ink");
}
