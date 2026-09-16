import { SHOWCASE_KINDS, type EventType, type ShowcaseKind } from "./types";

const TYPES: EventType[] = ["meeting", "social", "showcase", "other"];

export function parseEvent(body: Record<string, unknown>) {
  const { title, type, starts_at, ends_at, room, room_confirmed, location_note, description } = body;
  if (typeof title !== "string" || !title.trim()) return null;
  if (!TYPES.includes(type as EventType)) return null;
  if (typeof starts_at !== "string" || Number.isNaN(Date.parse(starts_at))) return null;
  return {
    title: title.trim().slice(0, 200),
    type: type as EventType,
    starts_at,
    ends_at: typeof ends_at === "string" && ends_at ? ends_at : null,
    room: typeof room === "string" && room.trim() ? room.trim().slice(0, 100) : null,
    room_confirmed: Boolean(room_confirmed),
    location_note:
      typeof location_note === "string" && location_note.trim()
        ? location_note.trim().slice(0, 300)
        : null,
    description:
      typeof description === "string" && description.trim()
        ? description.trim().slice(0, 1000)
        : null,
  };
}

export function parseShowcase(body: Record<string, unknown>) {
  const req = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const opt = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const title = req(body.title, 200);
  const does = req(body.does, 300);
  const by_line = req(body.by_line, 200);
  const when_label = req(body.when_label, 100);
  const limits = req(body.limits, 1000);
  if (!title || !does || !by_line || !when_label || !limits) return null;
  if (!SHOWCASE_KINDS.includes(body.kind as ShowcaseKind)) return null;

  // rating: both or neither, so the public page never shows half a rating
  const avg = typeof body.rating_average === "number" ? body.rating_average : null;
  const count = typeof body.rating_count === "number" ? body.rating_count : null;
  const rated = avg !== null && count !== null && avg >= 1 && avg <= 5 && count >= 1;

  // metric: all three or none
  const mLabel = opt(body.metric_label, 100);
  const mBefore = opt(body.metric_before, 50);
  const mAfter = opt(body.metric_after, 50);
  const hasMetric = Boolean(mLabel && mBefore && mAfter);

  const story = Array.isArray(body.story)
    ? body.story
        .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
        .map((s) => s.trim().slice(0, 2000))
        .slice(0, 12)
    : [];

  return {
    kind: body.kind as ShowcaseKind,
    title,
    does,
    by_line,
    affiliation: opt(body.affiliation, 200),
    partner: opt(body.partner, 200),
    when_label,
    rating_average: rated ? Math.round((avg as number) * 10) / 10 : null,
    rating_count: rated ? Math.floor(count as number) : null,
    running: Boolean(body.running),
    metric_label: hasMetric ? mLabel : null,
    metric_before: hasMetric ? mBefore : null,
    metric_after: hasMetric ? mAfter : null,
    story,
    limits,
    published: Boolean(body.published),
    sort_order:
      typeof body.sort_order === "number" && Number.isFinite(body.sort_order)
        ? Math.floor(body.sort_order)
        : 0,
  };
}
