"use client";

// The code form with `next` read from the address in the browser, since the
// account pages are static. Only a same-site path is followed, so a crafted
// ?next= cannot send a fresh session to another site.

import { useSearchParams } from "next/navigation";
import { CodeLoginForm } from "./CodeLoginForm";

const AUTH_PAGES = ["/login", "/signup"];

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/projectum";
  const url = new URL(next, "http://same.site");
  if (url.origin !== "http://same.site" || AUTH_PAGES.includes(url.pathname.replace(/\/$/, ""))) return "/projectum";
  return `${url.pathname}${url.search}`;
}

export function CodeLoginRoute() {
  const params = useSearchParams();
  return <CodeLoginForm next={safeNext(params.get("next"))} />;
}
