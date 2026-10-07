"use client";

// The sign-in form with `next` read from the address in the browser, since
// the account pages are static. Only a same-site path is followed, so a
// crafted ?next= cannot send a fresh session to another site.
//
// Google sign-in comes back here with the session, or an error, in the URL
// fragment (worker/src/accounts.ts). It is read once and cleared from the
// address so it never sits in the history.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { copy } from "@/content/copy";
import { adoptToken } from "@/lib/account";
import type { AccountRole } from "@/lib/email-rules";
import { CodeLoginForm } from "./CodeLoginForm";

const C = copy.auth.code;
const AUTH_PAGES = ["/login", "/signup"];
const ROLES: AccountRole[] = ["member", "rep", "partner"];

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/projectum";
  const url = new URL(next, "http://same.site");
  if (url.origin !== "http://same.site" || AUTH_PAGES.includes(url.pathname.replace(/\/$/, ""))) return "/projectum";
  return `${url.pathname}${url.search}`;
}

// The fragment as the page opened with it, read once and then cleared from
// the address. Empty on the server and for the first render.
let opened: string | null = null;
function readFragment(): string {
  if (opened === null) {
    opened = window.location.hash.slice(1);
    if (opened) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  return opened;
}
const subscribeNever = () => () => {};

function errorFrom(hash: URLSearchParams): { text?: string; role: AccountRole | null } {
  const error = hash.get("error");
  const role = ROLES.find((r) => r === hash.get("role")) ?? null;
  if (!error) return { role: null };
  if (error === "wrong-email" && role) return { text: C.wrongEmail[role], role };
  if (error === "google-unavailable") return { text: C.errors.googleUnavailable, role };
  if (error === "removed") return { text: copy.auth.errors.removed, role };
  return { text: C.errors.googleFailed, role };
}

export function CodeLoginRoute({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  // null until the browser has read the fragment.
  const fragment = React.useSyncExternalStore(subscribeNever, readFragment, () => null);
  const hash = React.useMemo(() => new URLSearchParams(fragment ?? ""), [fragment]);
  const token = hash.get("token");
  const [tokenFailed, setTokenFailed] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    void adoptToken(token).then((ok) => {
      if (ok) router.replace(safeNext(hash.get("next")));
      else setTokenFailed(true);
    });
  }, [token, hash, router]);
  // Used once: a later visit to this page in the same tab, after logging
  // out say, starts clean instead of replaying an old token or error.
  // Only once it has been read: hydration renders with the server's null
  // first, and its effects run before the browser's read.
  React.useEffect(() => {
    if (fragment !== null) opened = "";
  }, [fragment]);

  if (fragment === null || (token && !tokenFailed)) return null;
  const returned = tokenFailed ? { text: C.errors.googleFailed, role: null } : errorFrom(hash);
  return (
    <CodeLoginForm
      next={next}
      signup={signup}
      initialError={returned.text}
      initialRole={signup ? returned.role : null}
    />
  );
}
