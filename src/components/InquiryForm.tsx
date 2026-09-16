"use client";

// The conversation starter: the one form standard (2026-08-19). Four fields,
// single column, one prominent message box. Everything else gets asked in the
// reply we have already promised. Honesty rule stands: when storage is not
// live, the button opens a prefilled email instead of pretending to save.

import { useState } from "react";
import { copy } from "@/content/copy";
import { Field, inputClass } from "./ui/Field";
import type { InquiryKind } from "@/lib/types";

export interface ConversationFormCopy {
  formIntro: string;
  fields: {
    org: { label: string; help?: string };
    contact: { label: string; help?: string };
    email: { label: string; help?: string };
    problem: { label: string; help?: string };
  };
  submit: string;
  successHeading: string;
  successBody: string;
}

type FormState = "idle" | "sending" | "done";

export function InquiryForm({
  kind,
  text,
  formsLive,
  followupDays,
  mailSubject,
}: {
  kind: InquiryKind;
  text: ConversationFormCopy;
  formsLive: boolean;
  followupDays: number;
  mailSubject: string;
}) {
  const [state, setState] = useState<FormState>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);

  const F = text.fields;
  const intro = text.formIntro.replace("{days}", String(followupDays));
  const successBody = text.successBody.replace("{days}", String(followupDays));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    data.kind = kind;

    const nextErrors: Record<string, string> = {};
    for (const key of ["org_name", "contact_name", "email", "problem"]) {
      if (!data[key]?.trim()) nextErrors[key] = copy.forms.requiredError;
    }
    if (data.email?.trim() && !/^\S+@\S+\.\S+$/.test(data.email.trim())) {
      nextErrors.email = copy.forms.emailError;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!formsLive) {
      const body = [
        `Type: ${data.kind}`,
        `${F.org.label}: ${data.org_name}`,
        `Contact: ${data.contact_name}`,
        `Email: ${data.email}`,
        "",
        F.problem.label,
        data.problem,
      ].join("\n");
      window.location.href = `mailto:ailab@weber.edu?subject=${encodeURIComponent(
        `${mailSubject}: ${data.org_name}`,
      )}&body=${encodeURIComponent(body)}`;
      return;
    }

    setState("sending");
    setTopError(null);
    try {
      const res = await fetch("/api/partner-inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
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
        <h3 className="display text-xl">{text.successHeading}</h3>
        <p className="form-muted mt-2 leading-relaxed">{successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-none">
      <p className="form-muted text-[15px] leading-relaxed">{intro}</p>

      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <Field
            id="contact_name"
            label={F.contact.label}
            help={F.contact.help}
            error={errors.contact_name}
          >
            <input
              id="contact_name"
              name="contact_name"
              className={inputClass}
              aria-describedby="contact_name-help"
              aria-invalid={!!errors.contact_name}
              autoComplete="name"
            />
          </Field>
          <Field id="email" label={F.email.label} help={F.email.help} error={errors.email}>
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <Field id="org_name" label={F.org.label} help={F.org.help} error={errors.org_name}>
            <input
              id="org_name"
              name="org_name"
              className={inputClass}
              aria-describedby="org_name-help"
              aria-invalid={!!errors.org_name}
              autoComplete="organization"
            />
          </Field>
          <Field id="problem" label={F.problem.label} help={F.problem.help} error={errors.problem}>
            <textarea
              id="problem"
              name="problem"
              rows={4}
              className={inputClass}
              aria-describedby="problem-help"
              aria-invalid={!!errors.problem}
            />
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
          {state === "sending" ? copy.forms.sending : text.submit}
        </button>
        {!formsLive && <p className="form-muted text-sm">{copy.forms.emailFallbackNote}</p>}
      </div>
    </form>
  );
}
