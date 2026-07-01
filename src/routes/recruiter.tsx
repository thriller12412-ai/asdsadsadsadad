import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { mockLogout } from "@/lib/auth.functions";

export const Route = createFileRoute("/recruiter")({
  component: RecruiterLayout,
});

function RecruiterLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/portal" });
  }, [loading, user, nav, pathname]);

  const items: Array<{ to: "/recruiter" | "/recruiter/upload" | "/recruiter/candidates" | "/recruiter/pipeline" | "/recruiter/compare" | "/recruiter/analytics"; label: string; exact?: boolean }> = [
    { to: "/recruiter", label: "Overview", exact: true },
    { to: "/recruiter/upload", label: "Upload" },
    { to: "/recruiter/candidates", label: "Candidates" },
    { to: "/recruiter/pipeline", label: "Pipeline" },
    { to: "/recruiter/compare", label: "Compare" },
    { to: "/recruiter/analytics", label: "Analytics" },
  ];


  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between">
        <Link to="/" className="glass-panel rounded-full px-4 py-2 text-[12px] tracking-tight font-medium">
          Hirely.ai<span className="text-muted-foreground">.rec</span>
        </Link>
        <nav className="glass-panel rounded-full px-4 py-1.5 flex items-center gap-1">
          {items.map((i) => {
            const active = i.exact ? pathname === i.to : pathname.startsWith(i.to);
            return (
              <Link key={i.to} to={i.to as "/recruiter"}
                className={"px-3 py-1.5 rounded-full text-[11.5px] tracking-wide transition-all " +
                  (active ? "bg-ink text-background" : "text-muted-foreground hover:text-ink")}>
                {i.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => { await mockLogout(); window.location.href = "/"; }}
          className="glass-panel rounded-full px-3 py-2 text-[11px] text-muted-foreground hover:text-ink transition-colors"
        >
          Sign out
        </button>
      </header>
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.03] mix-blend-multiply"
        style={{ backgroundImage: "radial-gradient(rgba(0,0,0,.7) 1px, transparent 1px)", backgroundSize: "3px 3px" }} />
      {!user && !loading ? null : <Outlet />}
    </div>
  );
}
