// GET /calendar.ics: the whole existing agenda as one calendar file, built
// live from the events table. Imports into Google, Apple, and Outlook; once
// a public domain exists this same URL works as a from-URL subscription.

import { getEvents } from "@/lib/data";
import { buildIcsAll } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await getEvents();
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now);

  return new Response(buildIcsAll(upcoming), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="applied-ai-lab.ics"',
    },
  });
}
