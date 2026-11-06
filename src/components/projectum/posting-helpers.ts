// Small pure rules the posting views share: the notice board's discipline
// filter, when a posting last moved, the tags box, and the notes a returned
// posting came back with. Pure, so scripts/postings-ui.test.mjs runs them.

type Moved = {
  createdAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  reviews: { openedAt: string; decidedAt: string | null }[];
};

export type Facet = { slug: string; count: number };

// The disciplines the given postings use, each with how many use it, most
// used first and then in the taxonomy's order (`order`, slugs), so the
// filter never offers a chip that always shows nothing.
export function disciplineFacets(postings: { disciplines: string[] }[], order: readonly string[] = []): Facet[] {
  const counts = new Map<string, number>();
  for (const p of postings) for (const d of new Set(p.disciplines)) counts.set(d, (counts.get(d) ?? 0) + 1);
  const rank = (slug: string) => {
    const i = order.indexOf(slug);
    return i === -1 ? order.length : i;
  };
  return [...counts]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count || rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
}

// Whether a posting passes the filter: no chips picked shows everything,
// otherwise any one picked discipline is enough.
export function matchesDisciplines(posting: { disciplines: string[] }, picked: readonly string[]): boolean {
  return picked.length === 0 || posting.disciplines.some((d) => picked.includes(d));
}

// When a posting last moved: created, sent, a review opened or decided,
// published or closed. ISO strings compare as text.
export function postingSortKey(p: Moved): string {
  let latest = p.createdAt;
  for (const at of [p.submittedAt, p.publishedAt, p.closedAt, ...p.reviews.flatMap((r) => [r.openedAt, r.decidedAt])]) {
    if (at && at > latest) latest = at;
  }
  return latest;
}

// Newest move first.
export function sortPostings<T extends Moved>(postings: readonly T[]): T[] {
  return [...postings].sort((a, b) => postingSortKey(b).localeCompare(postingSortKey(a)));
}

// The tags box: comma separated, blanks dropped. The Worker turns each into
// a slug.
export function tagsFromText(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// The notes from the newest returned round, or "" when the latest decision
// was not a return.
export function latestReturnNotes(reviews: readonly { round: number; status: string; feedback: string }[]): string {
  const decided = reviews.filter((r) => r.status !== "open").sort((a, b) => b.round - a.round)[0];
  return decided?.status === "returned" ? decided.feedback : "";
}
