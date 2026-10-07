"use client";

// Sends an error in this browser to the Worker, which emails an alert
// (worker/src/alerts.ts). Only the message, where it came from in the code,
// and the page's path go; nothing about the person. At most five a page
// load, each message once, and never the noise browsers and extensions
// make on their own.

import { ACCOUNT_URL } from "@/lib/site";

const sent = new Set<string>();
const NOISE = [/ResizeObserver loop/, /^Script error\.?$/, /chrome-extension:|moz-extension:|safari-extension:/, /Load failed|Failed to fetch|NetworkError/];

export function reportError(error: unknown, where = "") {
  try {
    const message = (error instanceof Error ? error.message : String(error ?? "")).slice(0, 300);
    const stack = error instanceof Error ? (error.stack ?? "").slice(0, 2000) : "";
    if (!message || sent.size >= 5 || sent.has(message)) return;
    if (NOISE.some((r) => r.test(message) || r.test(stack))) return;
    sent.add(message);
    void fetch(`${ACCOUNT_URL}/client-errors`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, stack: where ? `${where}\n${stack}` : stack, page: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never cause an error of its own.
  }
}

// Listens for errors nothing else caught, for as long as the page is open.
export function watchErrors(): () => void {
  const onError = (e: ErrorEvent) => reportError(e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, "unhandled promise");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
