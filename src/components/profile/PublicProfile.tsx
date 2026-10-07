"use client";

// A member's public profile (appliedlab.ai/profile?u=handle), read in the
// browser from the Worker, since the site is static. The public site's look
// (design/STYLE.md): the mark and name at the top left, light type, an
// eyebrow for the level, and each project as a link card, a hairline on top.
// Only what the member chose to make public: no emails, plans or notes, and
// a partner's name only on accepted work, unless the partner hid it.

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StarMark } from "@/components/StarMark";
import { copy } from "@/content/copy";
import { initials } from "@/lib/initials";
import { ACCOUNT_URL } from "@/lib/site";

const P = copy.projectum.pipeline;
const F = P.profile;

type Level = "affiliate" | "sponsored" | "builder";
type Project = {
  title: string;
  partner: string | null;
  // A project the member proposed, rather than a partner's problem.
  own: boolean;
  team: string[];
  accepted: boolean;
  hired: boolean;
  completedAt: string | null;
  contribution: string;
  startedAt: string;
};
type Profile = {
  name: string;
  avatar: string | null;
  level: Level;
  fields: (keyof typeof P.fields)[];
  projects: Project[];
};

const eyebrow = "text-[11px] leading-none font-medium tracking-[0.18em] uppercase text-ink/35";

function ProjectCard({ project, name }: { project: Project; name: string }) {
  const others = project.team.filter((t) => t !== name);
  return (
    <li className="border-t border-black/[0.08] pt-6" data-profile-project="">
      <h3 className="text-xl leading-tight font-light tracking-tight lg:text-2xl">{project.title}</h3>
      <p className="mt-2 text-sm leading-relaxed font-light text-ink/60 lg:text-base">
        {[
          project.partner ? F.for(project.partner) : project.own ? F.studentProject : null,
          others.length ? F.team(others.join(", ")) : null,
        ]
          .filter(Boolean)
          .join(". ")}
      </p>
      {project.contribution && (
        <p className="mt-3 max-w-xl text-sm leading-relaxed font-light text-ink/60 lg:text-base">
          <span className="text-ink/40">{F.contribution}: </span>
          {project.contribution}
        </p>
      )}
      {project.hired && <p className={`${eyebrow} mt-4`}>{project.completedAt ? F.complete : F.hired}</p>}
    </li>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-archivo flex min-h-svh flex-col bg-white text-ink">
      <header className="flex h-16 items-center px-5 lg:px-15">
        <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap">
          <StarMark className="w-9" />
          <span className="text-[15px] font-medium tracking-tight">{copy.nav.wordmark}</span>
        </Link>
      </header>
      <main id="main" className="flex-1 px-5 pt-16 pb-24 lg:px-15 lg:pt-24">
        <div className="mx-auto max-w-3xl [overflow-wrap:anywhere] animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PublicProfile() {
  const handle = useSearchParams().get("u") ?? "";
  const [state, setState] = React.useState<{ profile?: Profile; missing?: boolean }>({});

  React.useEffect(() => {
    let live = true;
    if (!/^[a-z0-9-]{1,60}$/.test(handle)) {
      queueMicrotask(() => live && setState({ missing: true }));
      return;
    }
    fetch(`${ACCOUNT_URL}/profiles/${handle}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { profile: Profile }) => live && setState({ profile: d.profile }))
      .catch(() => live && setState({ missing: true }));
    return () => {
      live = false;
    };
  }, [handle]);

  if (state.missing) {
    return (
      <Frame>
        <p className="text-lg leading-relaxed font-light text-ink/60">{F.notFound}</p>
      </Frame>
    );
  }
  const profile = state.profile;
  if (!profile) return <Frame>{null}</Frame>;

  const working = profile.projects.filter((p) => !p.accepted);
  const done = profile.projects.filter((p) => p.accepted);
  return (
    <Frame>
      <div className="flex items-center gap-5" data-public-profile="">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-black/5 text-xl font-light">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- an inline data URL
            <img src={profile.avatar} alt="" className="size-full object-cover" />
          ) : (
            initials(profile.name)
          )}
        </div>
        <div className="grid gap-3">
          <p className={eyebrow} data-level={profile.level}>
            {P.levels[profile.level].name}
          </p>
          <h1 className="text-2xl leading-[1.15] font-light tracking-tight lg:text-4xl">{profile.name}</h1>
        </div>
      </div>
      <p className="mt-6 max-w-xl text-base leading-relaxed font-light text-ink/60 lg:text-lg">{P.levels[profile.level].meaning}</p>
      {profile.fields.length > 0 && (
        <p className="mt-4 text-sm font-light text-ink/50">
          <span className="text-ink/35">{F.fields}: </span>
          {profile.fields.map((f) => P.fields[f]).join(", ")}
        </p>
      )}

      {done.length > 0 && (
        <section className="mt-16">
          <h2 className={eyebrow}>{F.done}</h2>
          <ul className="mt-6 grid gap-10">
            {done.map((p, i) => (
              <ProjectCard key={i} project={p} name={profile.name} />
            ))}
          </ul>
        </section>
      )}
      {working.length > 0 && (
        <section className="mt-16">
          <h2 className={eyebrow}>{F.working}</h2>
          <ul className="mt-6 grid gap-10">
            {working.map((p, i) => (
              <ProjectCard key={i} project={p} name={profile.name} />
            ))}
          </ul>
        </section>
      )}
      {!profile.projects.length && <p className="mt-16 text-sm font-light text-ink/50">{F.none}</p>}
    </Frame>
  );
}
