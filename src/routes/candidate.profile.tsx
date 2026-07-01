import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/auth.functions";
import { listMyResumes } from "@/lib/resumes.functions";
import { listMyInterviews } from "@/lib/interviews.functions";

export const Route = createFileRoute("/candidate/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Hirely.ai Candidate" },
      { name: "description", content: "A minimal profile: resumes, recordings, achievements." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState<string>("");
  const [resumes, setResumes] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const pFn = useServerFn(getMyProfile);
  const rFn = useServerFn(listMyResumes);
  const iFn = useServerFn(listMyInterviews);

  useEffect(() => {
    pFn().then((p) => { setProfile(p.profile); setEmail(p.email ?? ""); }).catch(() => {});
    rFn().then((r) => setResumes(r ?? [])).catch(() => {});
    iFn().then((i) => setInterviews(i ?? [])).catch(() => {});
  }, [pFn, rFn, iFn]);

  const name = profile?.name ?? email.split("@")[0] ?? "You";
  const initial = name.charAt(0).toUpperCase();

  return (
    <main className="pt-28 pb-24 px-6 md:px-10">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center gap-3 mb-14">
          <span className="eyebrow">Profile</span>
          <span className="hairline flex-1" />
        </div>

        <div className="flex items-center gap-8">
          <div className="w-24 h-24 rounded-full bg-fog flex items-center justify-center text-3xl font-serif">{initial}</div>
          <div>
            <h1 className="text-5xl md:text-6xl tracking-tight font-medium">{name}</h1>
            <div className="mt-2 text-muted-foreground text-sm">
              {email}{profile?.created_at ? ` · Member since ${new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
            </div>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-16">
          <Section title="Resume Versions">
            {resumes.length === 0 ? (
              <div className="text-sm text-muted-foreground">No resumes uploaded yet.</div>
            ) : (
              <ul className="divide-y divide-black/10">
                {resumes.map((r, i) => (
                  <li key={r.id} className="py-4 flex items-center justify-between">
                    <div>
                      <div className="text-[15px]">{r.file_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    {i === 0 && <span className="text-[10px] tracking-[.24em] uppercase text-champagne">Latest</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Interview Sessions">
            {interviews.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sessions yet.</div>
            ) : (
              <ul className="divide-y divide-black/10">
                {interviews.slice(0, 6).map((r) => (
                  <li key={r.id} className="py-4 flex items-center justify-between">
                    <div>
                      <div className="text-[15px]">{r.role_target || "Interview"}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(r.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div className="font-serif text-xl">{r.interview_results?.[0]?.overall_score ?? "—"}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-6">{title}</div>
      {children}
    </div>
  );
}
