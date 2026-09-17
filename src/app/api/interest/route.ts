// POST /api/interest: Join the Lab on the Next.js server (npm run
// dev:server). Checks the form with the shared rules (src/lib/interest.ts)
// and appends it to data/interest.jsonl, one form per line, which is
// gitignored. The static site
// posts to the Worker instead, which keeps submissions in Cloudflare KV.

import fs from "node:fs/promises";
import path from "node:path";
import { checkInterest } from "@/lib/interest";
import { ipFrom, rateLimited } from "@/lib/rate-limit";

const FILE = path.join(process.cwd(), "data", "interest.jsonl");

export async function POST(req: Request) {
  if (rateLimited(ipFrom(req), "interest")) return new Response(null, { status: 429 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // The bot trap: accept quietly, keep nothing.
  if (body?.website) return new Response(null, { status: 204 });

  const checked = checkInterest(body);
  if ("errors" in checked) return Response.json(checked, { status: 400 });

  await fs.appendFile(FILE, JSON.stringify({ ...checked.value, at: new Date().toISOString() }) + "\n");
  return new Response(null, { status: 204 });
}
