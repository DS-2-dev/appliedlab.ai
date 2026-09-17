// POST /api/interest: Join the Lab on the Next.js server (npm run
// dev:server). Checks the form with the shared rules (src/lib/interest.ts)
// and appends it to data/interest.json, which is gitignored. The static site
// posts to the Worker instead, which keeps submissions in Cloudflare KV.

import fs from "node:fs/promises";
import path from "node:path";
import { checkInterest } from "@/lib/interest";
import { ipFrom, rateLimited } from "@/lib/rate-limit";

const FILE = path.join(process.cwd(), "data", "interest.json");

export async function POST(req: Request) {
  if (rateLimited(ipFrom(req), "interest")) return new Response(null, { status: 429 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // The bot trap: accept quietly, keep nothing.
  if (body?.website) return new Response(null, { status: 204 });

  const checked = checkInterest(body);
  if ("errors" in checked) return Response.json(checked, { status: 400 });

  const list = JSON.parse(await fs.readFile(FILE, "utf8").catch(() => "[]")) as unknown[];
  list.push({ ...checked.value, at: new Date().toISOString() });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2));
  return new Response(null, { status: 204 });
}
