import { normalizeEmail, type AccountRole } from "@/lib/email-rules";
import { ROLES, type Level, type Role } from "@/lib/pipeline/domain";
import { type AlertEnv, alert } from "./alerts";

export interface AccountEnv {
  DB: D1Database;
  // Submitted final reports (submissions.ts).
  REPORTS: KVNamespace;
  LOGIN_LIMITER: RateLimit;
  LOGIN_IP_LIMITER: RateLimit;
  // Hashes codes and signs approval links. A wrangler secret.
  AUTH_SECRET: string;
  // Resend (resend.com) sends the emails. Without a key, codes cannot be
  // sent, except locally, where DEV_CODES=1 returns them in the response.
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  DEV_CODES?: string;
  // Who approves new partners, and gets the emails about what's waiting.
  APPROVER_EMAIL: string;
  // More approvers, comma separated, who don't get those emails.
  APPROVERS?: string;
  // The site, for links in emails.
  SITE_URL: string;
}

const MAX_PERSON_NAME = 80;

export type Status = "active" | "pending" | "removed";

export const USER_COLS =
  "id, email, name, role, status, avatar, profile_public, handle, claude_access, hide_name, roles, org_id, level, level_locked, interests, digest, digest_sent_at";

export type { Level };

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  status: Status;
  avatar: string | null;
  profile_public?: number;
  handle?: string | null;
  claude_access?: number;
  hide_name?: number;
  // A JSON array of roles, always holding `role`. Sign-up never stores
  // "admin" here; it comes from isAdmin.
  roles: string;
  org_id: string | null;
  level: Level;
  level_locked: number;
  // A JSON array of tags.
  interests: string;
  // Whether they get the daily digest email (notify.ts), and when the last one went.
  digest?: number;
  digest_sent_at?: string | null;
}

function parseList(text: string | undefined): unknown[] {
  try {
    const v: unknown = JSON.parse(text || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// The roles the account holds: the stored list, de-duplicated, always with
// its own `role`, and never "admin" (that is isAdmin's call).
export function rolesOf(u: Pick<UserRow, "role" | "roles">): Role[] {
  const known = (ROLES as readonly string[]).filter((r) => r !== "admin");
  const stored = parseList(u.roles).filter((r): r is Role => typeof r === "string" && known.includes(r));
  return [...new Set<Role>([u.role, ...stored])];
}

// Admins: active accounts whose roles list says admin, the Lab's approver
// (APPROVER_EMAIL), and anyone listed in APPROVERS, whatever their role.
export function isAdmin(env: AccountEnv, u: { email: string; status: string; roles?: string }): boolean {
  if (u.status !== "active") return false;
  if (parseList(u.roles).includes("admin")) return true;
  const listed = [env.APPROVER_EMAIL, ...(env.APPROVERS ?? "").split(",")].map((e) => normalizeEmail(e)).filter(Boolean);
  return listed.includes(normalizeEmail(u.email));
}

export function hasRole(env: AccountEnv, u: RoleSubject, r: Role): boolean {
  return r === "admin" ? isAdmin(env, u) : rolesOf(u).includes(r);
}

type RoleSubject = { email: string; role: AccountRole; status: string; roles: string };

// Reps and admins: the Lab's staff.
export function isStaff(env: AccountEnv, u: RoleSubject): boolean {
  return u.status === "active" && (hasRole(env, u, "rep") || isAdmin(env, u));
}

// The organization an account belongs to, for the browser.
async function orgSummary(env: AccountEnv, u: UserRow) {
  if (!u.org_id) return null;
  const o = await env.DB.prepare("SELECT id, slug, name, primary_user_id FROM orgs WHERE id = ?")
    .bind(u.org_id)
    .first<{ id: string; slug: string; name: string; primary_user_id: string | null }>();
  return o ? { id: o.id, slug: o.slug, name: o.name, primary: o.primary_user_id === u.id } : null;
}

// The organization a pending partner is waiting on, by name, so the waiting
// page can say whose answer it is.
async function pendingOrgName(env: AccountEnv, u: UserRow): Promise<string | null> {
  if (u.org_id) return null;
  const r = await env.DB.prepare(
    "SELECT o.name FROM org_requests r JOIN orgs o ON o.id = r.org_id WHERE r.user_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC LIMIT 1",
  )
    .bind(u.id)
    .first<{ name: string }>();
  return r?.name ?? null;
}

// What the browser gets about the signed-in person. A member's level is the
// stored one; everyone else has none.
export async function accountOut(u: UserRow, env: AccountEnv) {
  const admin = isAdmin(env, u);
  const roles = rolesOf(u);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    roles: admin ? [...roles, "admin" as Role] : roles,
    admin,
    status: u.status,
    avatar: u.avatar,
    level: u.role === "member" ? u.level : null,
    levelLocked: Boolean(u.level_locked),
    orgId: u.org_id,
    org: await orgSummary(env, u),
    pendingOrgName: await pendingOrgName(env, u),
    profilePublic: Boolean(u.profile_public),
    handle: u.handle ?? null,
    claudeAccess: Boolean(u.claude_access),
    hideName: Boolean(u.hide_name),
    interests: parseList(u.interests).filter((t): t is string => typeof t === "string"),
    digest: Boolean(u.digest),
  };
}

// A profile's address: the name as a slug, plus a few letters so two Sam
// Lees don't collide.
export function handleFor(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .slice(0, 40);
  const tail = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  return `${slug || "member"}-${tail}`;
}

const enc = new TextEncoder();

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Equal-time comparison of two hex strings.
export function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function cleanPersonName(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_PERSON_NAME) : "";
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function sendEmail(env: AccountEnv, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Applied AI Lab <login@appliedlab.ai>",
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) {
    // Sign-in codes go out this way, so a refused email locks people out.
    await alert(env as AlertEnv, "Email failed", `Resend refused an email (${res.status})`);
  }
  return res.ok;
}

export type Json = (body: unknown, status?: number) => Response;
