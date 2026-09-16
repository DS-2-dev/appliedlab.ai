/*
  Showcase page copy that is genuinely static. The entries themselves are DATA,
  not code: they live in the showcase_entries table (data/showcase.json in
  local preview) and are edited at /admin/showcase. Publishing December's
  member work is an admin action, never a code change (succession rule).

  Voice: brand spec §3 plus Kylar's 2026-08-17 direction.
*/

/** What a publication shows. Rendered on the empty state so a member preparing a submission can see the target. */
export const PUBLICATION_SCHEMA = [
  "The tool, and what it does in one sentence",
  "Screenshots, where they can be shown",
  "The member who built it",
  "The college and department",
  "The partner, once they approve being named",
  "The faculty rating, with the number of reviewers",
  "The story of the experience, the challenges, and the process",
  "What the tool doesn't do",
] as const;
