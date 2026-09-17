"use client";

// A piece of text that copies itself when clicked, with a copy icon that
// turns into a check for a moment to confirm.

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyText({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // No clipboard access: fall back to opening the mail app.
      window.location.href = `mailto:${text}`;
    }
  };

  const Icon = copied ? Check : Copy;
  return (
    <button type="button" onClick={copy} aria-label={label} className={className}>
      {text}
      <Icon aria-hidden className="size-3.5 opacity-60" strokeWidth={1.75} />
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
