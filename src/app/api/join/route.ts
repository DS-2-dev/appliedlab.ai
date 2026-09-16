import { NextResponse } from "next/server";
import { createStudentSignup } from "@/lib/data";
import { ipFrom, rateLimited } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // honeypot
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (rateLimited(ipFrom(req), "join")) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const { name, email, major } = body;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email.trim())
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const result = await createStudentSignup({
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      major: typeof major === "string" && major.trim() ? major.trim().slice(0, 200) : null,
    });
    if (result.duplicate) {
      return NextResponse.json({ error: "duplicate" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }
}
