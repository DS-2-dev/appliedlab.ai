"use client";

// The Notice Board (members and staff: every live partner posting, filtered
// by discipline and searched, with Claim) and My Postings (a partner's
// organization's postings, with Post a problem; admins also get every
// partner posting, and post for the Lab from here).

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Gauge, Plus, Search, Users } from "lucide-react";
import { copy } from "@/content/copy";
import { useAccount } from "@/lib/account";
import { CourtStrip } from "@/components/projectum/court-list";
import { ClaimDialog } from "@/components/projectum/claim-dialog";
import { type Posting, useApi } from "@/components/projectum/pipeline-store";
import { DisciplineTags, Empty, LoadError, Loading, ViewFrame, formatDate, useTaxonomy } from "@/components/projectum/pipeline-ui";
import { PostingFormDialog } from "@/components/projectum/posting-form";
import { disciplineFacets, matchesDisciplines, postingSortKey, sortPostings } from "@/components/projectum/posting-helpers";
import { StatusPill } from "@/components/projectum/status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const P = copy.projectum.pipeline;
const B = P.board;

export const postingHref = (id: string) => `/projectum?posting=${encodeURIComponent(id)}`;
const boardHref = (p: NonNullable<Posting["myProject"]>) =>
  p.boardId ? `/projectum?project=${encodeURIComponent(p.boardId)}` : `/projectum?view=project&id=${encodeURIComponent(p.id)}`;

function PostingCard({
  posting,
  name,
  canClaim,
  onClaim,
}: {
  posting: Posting;
  name: (slug: string) => string;
  canClaim: boolean;
  onClaim: () => void;
}) {
  return (
    <Card size="sm" data-posting-card="" className="relative h-full gap-3 transition-colors hover:bg-muted/40">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2">
            {/* The title's link covers the card; the buttons sit above it. */}
            <Link
              href={postingHref(posting.id)}
              className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {posting.title}
            </Link>
          </CardTitle>
          <StatusPill kind="posting" status={posting.status} size="sm" className="relative" />
        </div>
        {posting.org && <p className="truncate text-xs text-muted-foreground">{posting.org.name}</p>}
        <CardDescription className="line-clamp-2">{posting.summary}</CardDescription>
      </CardHeader>
      <div className="mt-auto grid gap-3 px-3 pb-3">
        <DisciplineTags slugs={posting.disciplines} name={name} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {B.teams(posting.counts.open)}
          </span>
          {posting.effort && (
            <span className="flex items-center gap-1">
              <Gauge className="size-3.5" />
              {P.efforts[posting.effort]}
            </span>
          )}
          {posting.deadline && (
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {B.due(formatDate(posting.deadline))}
            </span>
          )}
        </div>
        {posting.myProject ? (
          <Link
            href={boardHref(posting.myProject)}
            className={`${buttonVariants({ variant: "secondary", size: "sm" })} relative justify-self-start`}
          >
            {B.onIt}
          </Link>
        ) : (
          canClaim && (
            <Button size="sm" className="relative justify-self-start" onClick={onClaim}>
              {B.claim}
            </Button>
          )
        )}
      </div>
    </Card>
  );
}

export function NoticeBoard() {
  const me = useAccount();
  const { data, error, retry } = useApi<{ postings: Posting[] }>("/postings?scope=board");
  const { taxonomy, name } = useTaxonomy();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState("");
  const [claiming, setClaiming] = React.useState<Posting | null>(null);
  const postings = data?.postings ?? [];
  const facets = disciplineFacets(postings, taxonomy?.disciplines.map((d) => d.slug));
  const q = query.trim().toLowerCase();
  const matches = (p: Posting) =>
    !q || [p.title, p.summary, p.details, p.org?.name ?? "", ...p.tags].some((t) => t.toLowerCase().includes(q));
  const shown = postings.filter((p) => matchesDisciplines(p, picked) && matches(p));
  // Staff see the board but claim only with the member role.
  const canClaim = me.roles.includes("member") && me.status === "active";
  const toggle = (slug: string) => setPicked((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));

  return (
    <ViewFrame
      title={B.title}
      description={B.description}
      action={
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={B.search}
            placeholder={B.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      {error && !data ? (
        <LoadError retry={retry} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <CourtStrip />
          {facets.length > 1 && (
            <div role="group" aria-label={B.filterLabel} className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={picked.length ? "outline" : "secondary"} aria-pressed={!picked.length} onClick={() => setPicked([])}>
                {B.all}
              </Button>
              {facets.map((f) => (
                <Button
                  key={f.slug}
                  size="sm"
                  variant={picked.includes(f.slug) ? "secondary" : "outline"}
                  aria-pressed={picked.includes(f.slug)}
                  onClick={() => toggle(f.slug)}
                >
                  {name(f.slug)}
                  <span className="text-muted-foreground tabular-nums">{f.count}</span>
                </Button>
              ))}
            </div>
          )}
          {shown.length ? (
            <div data-posting-grid="" className="grid grid-cols-3 gap-4 xl:grid-cols-4">
              {shown.map((p) => (
                <PostingCard key={p.id} posting={p} name={name} canClaim={canClaim} onClaim={() => setClaiming(p)} />
              ))}
            </div>
          ) : (
            <Empty>{B.empty}</Empty>
          )}
        </>
      )}
      {claiming && <ClaimDialog open onOpenChange={(o) => !o && setClaiming(null)} posting={claiming} />}
    </ViewFrame>
  );
}

const C = P.postings.columns;

// Postings as rows, newest move first; a row opens its posting.
function PostingTable({ postings, withOrg }: { postings: Posting[]; withOrg?: boolean }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{C.title}</th>
            {withOrg && <th className="px-3 py-2 font-medium">{C.org}</th>}
            <th className="px-3 py-2 font-medium">{C.status}</th>
            <th className="px-3 py-2 font-medium">{C.teams}</th>
            <th className="px-3 py-2 font-medium">{C.updated}</th>
          </tr>
        </thead>
        <tbody>
          {sortPostings(postings).map((p) => (
            <tr
              key={p.id}
              data-posting-row=""
              className="cursor-pointer border-t transition-colors hover:bg-muted/40"
              onClick={() => router.push(postingHref(p.id))}
            >
              <td className="px-3 py-2.5 font-medium">
                <Link href={postingHref(p.id)} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                  {p.title}
                </Link>
              </td>
              {withOrg && <td className="px-3 py-2.5 text-muted-foreground">{p.org?.name ?? ""}</td>}
              <td className="px-3 py-2.5">
                <StatusPill kind="posting" status={p.status} size="sm" />
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{P.postings.counts(p.counts.open, p.counts.delivered)}</td>
              <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{formatDate(postingSortKey(p))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rows({ path, empty, withOrg }: { path: string; empty: string; withOrg?: boolean }) {
  const { data, error, retry } = useApi<{ postings: Posting[] }>(path);
  if (error && !data) return <LoadError retry={retry} />;
  if (!data) return <Loading />;
  return data.postings.length ? <PostingTable postings={data.postings} withOrg={withOrg} /> : <Empty>{empty}</Empty>;
}

export function MyPostings() {
  const me = useAccount();
  const partner = me.role === "partner";
  // A partner posts for their organization; an admin, for the Lab.
  const canPost = me.status === "active" && ((partner && Boolean(me.orgId)) || me.admin);
  const mine = useApi<{ postings: Posting[] }>(partner && me.orgId ? "/postings?scope=mine" : null).data;
  const [posting, setPosting] = React.useState(false);
  const S = P.postings;

  return (
    <ViewFrame
      title={partner ? S.title : S.allTitle}
      description={partner ? S.description : S.allDescription}
      action={
        canPost && (
          <Button onClick={() => setPosting(true)}>
            <Plus />
            {S.post}
          </Button>
        )
      }
    >
      <CourtStrip />
      {partner &&
        (me.orgId ? (
          <Rows path="/postings?scope=mine" empty={S.empty} />
        ) : (
          <div className="grid justify-items-start gap-3 rounded-lg border border-dashed p-6 text-sm">
            <p>{S.noOrg}</p>
            <Link href="/projectum?view=org" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {S.orgLink}
            </Link>
          </div>
        ))}
      {me.admin && (
        <section className="grid gap-3">
          {partner && <h2 className="text-lg font-medium">{S.allTitle}</h2>}
          <Rows path="/postings?scope=all" empty={S.allEmpty} withOrg />
        </section>
      )}
      <PostingFormDialog
        open={posting}
        onOpenChange={setPosting}
        orgName={partner ? (me.org?.name ?? "") : ""}
        firstPosting={partner && mine?.postings.length === 0}
      />
    </ViewFrame>
  );
}
