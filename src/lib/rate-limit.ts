// In-memory rate limit per IP, per form, per hour. Per-instance only, which
// is fine at club scale. Callers (the sign-in actions, Ask the Lab) pass
// their own limits; the default of five an hour suits a one-off form.

const WINDOW_MS = 60 * 60 * 1000;
const MAX = 5;

const hits = new Map<string, number[]>();

export function rateLimited(
  ip: string,
  form: string,
  { max = MAX, windowMs = WINDOW_MS }: { max?: number; windowMs?: number } = {},
): boolean {
  const key = `${form}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export function ipFrom(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

// The same lookup for server actions, which get headers rather than a Request.
export function ipFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}
