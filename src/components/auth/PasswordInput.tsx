"use client";

// A password field with a show/hide toggle. The toggle is a real button with
// aria-pressed and a label that says what it will do, and it sits inside the
// field's right edge so the field keeps the same width as every other one.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass } from "@/components/ui/Field";
import { copy } from "@/content/copy";

export function PasswordInput({
  id,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name="password"
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        required
        className={`${inputClass} pr-11`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-pressed={shown}
        aria-label={shown ? copy.auth.fields.hide : copy.auth.fields.show}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-ink-faint transition-colors hover:text-ink"
      >
        {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}
