// The rules every sign-in path shares, in one dependency-free module so they
// can be tested directly (scripts/auth-rules.test.mjs) rather than through a
// running server. Server-only in practice: it uses node:crypto.
//
// Nothing here trusts the browser. The forms run these checks for the error
// messages, the server actions run them again, and the database trigger in
// supabase/002-member-accounts.sql enforces the domain rule a third time.

import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// The email checks live in email-rules.ts, which has no node:crypto, so the
// browser and the Worker can use them too. A relative path with its
// extension, so the tests can load this file straight into Node.
export { WEBER_DOMAINS, isWeberEmail, looksLikeEmail, normalizeEmail } from "./email-rules.ts";

// 8 characters minimum. 72 bytes maximum, because Supabase stores passwords
// with bcrypt, which silently ignores everything past the 72nd byte: a longer
// password would be accepted and then only partly checked.
export function passwordProblem(password: string): "required" | "short" | "long" | null {
  if (!password) return "required";
  if (password.length < 8) return "short";
  if (Buffer.byteLength(password, "utf8") > 72) return "long";
  return null;
}

// Any C0 control character or DEL. A loop rather than a regex so the source
// holds no raw control characters of its own.
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 32 || c === 127) return true;
  }
  return false;
}

// Where to send someone after they sign in. Only a same-site path is allowed,
// so a crafted ?next= cannot bounce a fresh session to another site. The
// auth pages themselves fall back to /projectum, which stops a loop back
// into the login form.
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function safeNext(next: string | null | undefined, fallback = "/projectum"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  if (hasControlChars(next)) return fallback;
  const url = new URL(next, "http://same.site");
  if (url.origin !== "http://same.site") return fallback;
  if (AUTH_PAGES.includes(url.pathname)) return fallback;
  return `${url.pathname}${url.search}`;
}

// --- Local preview only -----------------------------------------------------
// Password hashing and signed cookies for the development fallback, used when
// no Supabase project is configured. The live site never runs these: in
// Supabase mode, Supabase owns passwords and sessions.

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return ["scrypt", salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "base64url");
  const expected = Buffer.from(parts[2], "base64url");
  if (salt.length === 0 || expected.length !== SCRYPT.keylen) return false;
  const actual = await scryptAsync(password, salt);
  return timingSafeEqual(actual, expected);
}

// A payload, its expiry, and an HMAC over both. Tampering with either the
// body or the expiry breaks the signature, and the comparison is constant
// time so the signature cannot be guessed a byte at a time.
export function signSession(payload: Record<string, string>, secret: string, expiresAt: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: expiresAt })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(
  token: string,
  secret: string,
  now: number = Date.now(),
): Record<string, string> | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { exp, ...payload } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof exp !== "number" || exp <= now) return null;
    return payload as Record<string, string>;
  } catch {
    return null;
  }
}
