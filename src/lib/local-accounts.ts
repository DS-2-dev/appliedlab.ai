// Local-preview accounts: the development stand-in for Supabase Auth, so the
// log in, sign up and reset flows can be built and tried before the club's
// Supabase project exists.
//
// Only ever reached through devAuthAllowed() (NODE_ENV development AND no
// Supabase env), the same guard the old dev-officer cookie used, so a
// deployed site cannot fall into it. Accounts live in data/users.json and the
// cookie-signing secret in data/.session-secret. Both are gitignored: they
// hold password hashes and a key, and neither belongs in the repository.

import { promises as fs } from "fs";
import path from "path";
import { randomBytes, randomUUID } from "crypto";
import {
  hashPassword,
  normalizeEmail,
  readSession,
  signSession,
  verifyPassword,
} from "./auth-rules";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SECRET_FILE = path.join(DATA_DIR, ".session-secret");

export const LOCAL_SESSION_COOKIE = "aail_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export interface LocalUser {
  id: string;
  email: string;
  full_name: string | null;
  password_hash: string;
  created_at: string;
}

async function readUsers(): Promise<LocalUser[]> {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf8")) as LocalUser[];
  } catch {
    return [];
  }
}

async function writeUsers(users: LocalUser[]): Promise<void> {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function findLocalUserById(id: string): Promise<LocalUser | null> {
  return (await readUsers()).find((u) => u.id === id) ?? null;
}

export async function createLocalUser(input: {
  email: string;
  full_name: string;
  password: string;
}): Promise<LocalUser | "exists"> {
  const users = await readUsers();
  const email = normalizeEmail(input.email);
  if (users.some((u) => u.email === email)) return "exists";
  const user: LocalUser = {
    id: randomUUID(),
    email,
    full_name: input.full_name.trim() || null,
    password_hash: await hashPassword(input.password),
    created_at: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  return user;
}

// Hashes against a throwaway value when the email is unknown, so a missing
// account and a wrong password take the same time. Otherwise the response
// time alone would say which emails have accounts.
let dummyHash: Promise<string> | null = null;

export async function checkLocalPassword(email: string, password: string): Promise<LocalUser | null> {
  const user = (await readUsers()).find((u) => u.email === normalizeEmail(email));
  if (!user) {
    dummyHash ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, user.password_hash)) ? user : null;
}

export async function findLocalUserByEmail(email: string): Promise<LocalUser | null> {
  return (await readUsers()).find((u) => u.email === normalizeEmail(email)) ?? null;
}

export async function setLocalPassword(id: string, password: string): Promise<void> {
  const users = await readUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return;
  user.password_hash = await hashPassword(password);
  await writeUsers(users);
}

let secretCache: string | null = null;

async function sessionSecret(): Promise<string> {
  if (secretCache) return secretCache;
  try {
    secretCache = (await fs.readFile(SECRET_FILE, "utf8")).trim();
  } catch {
    secretCache = randomBytes(32).toString("hex");
    await fs.writeFile(SECRET_FILE, secretCache, { encoding: "utf8", mode: 0o600 });
  }
  return secretCache;
}

// `purpose` separates the two token kinds, so a reset link cannot be pasted
// into the session cookie and a session cannot be replayed as a reset.
export async function issueLocalSession(uid: string): Promise<{ token: string; expires: Date }> {
  const expires = Date.now() + SESSION_TTL_MS;
  return {
    token: signSession({ uid, purpose: "session" }, await sessionSecret(), expires),
    expires: new Date(expires),
  };
}

export async function readLocalSession(token: string): Promise<string | null> {
  const payload = readSession(token, await sessionSecret());
  return payload?.purpose === "session" ? (payload.uid ?? null) : null;
}

export async function issueResetToken(uid: string): Promise<string> {
  return signSession({ uid, purpose: "reset" }, await sessionSecret(), Date.now() + RESET_TTL_MS);
}

export async function readResetToken(token: string): Promise<string | null> {
  const payload = readSession(token, await sessionSecret());
  return payload?.purpose === "reset" ? (payload.uid ?? null) : null;
}
