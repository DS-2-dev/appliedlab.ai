// Passwords, for signing in without waiting on an email. A password is only
// ever set right after a sign-in code proved the address, so it never stands
// in for that proof. Stored as PBKDF2-SHA256 with a random salt, with the
// iteration count kept in the string so it can rise later. 100,000 is the
// most the Workers runtime allows.

const ITERATIONS = 100_000;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;

const enc = new TextEncoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export function passwordProblem(password: unknown): "password-short" | "password-long" | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return "password-short";
  if (password.length > MAX_PASSWORD) return "password-long";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  const iterations = Number(iter);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(iterations) || !salt || !hash) return false;
  const got = await derive(password, unb64(salt), iterations);
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}
