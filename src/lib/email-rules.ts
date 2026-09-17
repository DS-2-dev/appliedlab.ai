// Email checks shared by sign-in (auth-rules.ts), the join form and the
// Worker. Dependency-free, so it runs in the browser, on the server and on
// Cloudflare alike.

export const WEBER_DOMAINS = ["weber.edu", "mail.weber.edu"] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Exactly one @, a non-empty local part, and a domain that is one of the two
// exactly. Suffix matching is the classic hole here ("notweber.edu",
// "weber.edu.evil.com", "evil.weber.edu"), so the comparison is equality.
export function isWeberEmail(email: string): boolean {
  const e = normalizeEmail(email);
  const parts = e.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local) return false;
  return (WEBER_DOMAINS as readonly string[]).includes(domain);
}

export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}
