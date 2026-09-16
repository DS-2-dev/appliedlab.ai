"use client";

// The student signup, on the conversation-form standard: three fields, single
// column. Membership is showing up; this keeps a student in the loop. Same
// honesty rule as every form: without live storage, the button opens email.

import { useState } from "react";
import { copy } from "@/content/copy";
import { Field, inputClass } from "./ui/Field";

const J = copy.join;

type FormState = "idle" | "sending" | "done";

export function JoinForm({ formsLive }: { formsLive: boolean }) {
  const [state, setState] = useState<FormState>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<
      string,
      string
    >;

    const nextErrors: Record<string, string> = {};
    if (!data.name?.trim()) nextErrors.name = copy.forms.requiredError;
    if (!data.email?.trim()) nextErrors.email = copy.forms.requiredError;
    else if (!/^\S+@\S+\.\S+$/.test(data.email.trim())) nextErrors.email = copy.forms.emailError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!formsLive) {
      const body = [
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        data.major ? `Major or college: ${data.major}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      window.location.href = `mailto:ailab@weber.edu?subject=${encodeURIComponent(
        `Joining the Lab: ${data.name}`,
      )}&body=${encodeURIComponent(body)}`;
      return;
    }

    setState("sending");
    setTopError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 409) {
        setTopError(J.duplicateMsg);
        setState("idle");
        return;
      }
      if (res.status === 429) {
        setTopError(copy.forms.rateLimited);
        setState("idle");
        return;
      }
      if (!res.ok) throw new Error("failed");
      setState("done");
    } catch {
      setTopError(copy.forms.genericError);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div
        className="max-w-xl rounded-[var(--radius-control)] border border-[#166534] bg-[#14251a] p-6 md:p-8"
        role="status"
      >
        <h3 className="display text-xl">{J.successHeading}</h3>
        <p className="form-muted mt-2 leading-relaxed">{J.successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-none">
      <p className="form-muted text-[15px] leading-relaxed">{J.formIntro}</p>

      {/* Short answers share one row when space allows; mobile keeps the
          familiar single-column reading order. */}
      <div className="mt-4">
        <div className="grid gap-4 sm:grid-cols-3 sm:items-start">
          <Field id="name" label={J.fields.name.label} error={errors.name}>
            <input
              id="name"
              name="name"
              className={inputClass}
              aria-invalid={!!errors.name}
              autoComplete="name"
            />
          </Field>
          <Field
            id="email"
            label={J.fields.email.label}
            help={J.fields.email.help}
            error={errors.email}
          >
            <input
              id="email"
              name="email"
              type="email"
              className={inputClass}
              aria-describedby="email-help"
              aria-invalid={!!errors.email}
              autoComplete="email"
            />
          </Field>
          <Field id="major" label={J.fields.major.label}>
            <input id="major" name="major" className={inputClass} />
          </Field>
        </div>
      </div>

      {/* honeypot: real people never see or fill this */}
      <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {topError && (
        <p
          role="alert"
          className="form-error mt-4 rounded-[var(--radius-control)] border border-[#7f1d1d] bg-[#2a1717] px-4 py-3 text-sm"
        >
          {topError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === "sending"}
          className="btn bg-brand text-white hover:bg-[#8154bd] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "sending" ? copy.forms.sending : J.submit}
        </button>
        {!formsLive && <p className="form-muted text-sm">{copy.forms.emailFallbackNote}</p>}
      </div>
    </form>
  );
}
