import { NextResponse } from "next/server";
import { createInquiry } from "@/lib/data";
import { ipFrom, rateLimited } from "@/lib/rate-limit";
import { INQUIRY_KINDS, type InquiryKind } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // honeypot
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (rateLimited(ipFrom(req), "partner-inquiry")) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const { kind, org_name, contact_name, email, phone, problem, anything_else, how_heard } = body;
  // Unknown or missing kind falls back to casework rather than rejecting, so a
  // stale cached form never loses a real inquiry.
  const inquiryKind: InquiryKind = INQUIRY_KINDS.includes(kind) ? kind : "casework";
  if (
    typeof org_name !== "string" ||
    !org_name.trim() ||
    typeof contact_name !== "string" ||
    !contact_name.trim() ||
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email.trim()) ||
    typeof problem !== "string" ||
    !problem.trim()
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const opt = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  try {
    await createInquiry({
      kind: inquiryKind,
      org_name: org_name.trim().slice(0, 300),
      contact_name: contact_name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      phone: opt(phone, 50),
      problem: problem.trim().slice(0, 5000),
      anything_else: opt(anything_else, 5000),
      how_heard: opt(how_heard, 500),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }
}
