"use client";

// Join the Lab: one form for students, faculty and organizations. The role
// picker at the top swaps the details underneath, the rules come from
// lib/interest.ts (the same ones the server and the Worker run), and a sent
// form gives way to a thank-you.
//
// On the static site it posts to the Worker, which keeps submissions in
// Cloudflare KV; with a server it posts to /api/interest. A hidden
// `website` field catches bots: people never see it, so anything in it is
// quietly dropped on the other end.

import { useState } from "react";
import { BookOpen, Building2, ChevronDown, GraduationCap, Loader2 } from "lucide-react";
import { copy } from "@/content/copy";
import { Field, inputClass } from "@/components/ui/Field";
import {
  NOTE_MAX,
  ROLE_FIELDS,
  ROLES,
  SHORT_MAX,
  YEARS,
  checkInterest,
  type InterestErrors,
  type InterestField,
  type Role,
} from "@/lib/interest";
import { INTEREST_URL } from "@/lib/site";
import { cn } from "@/lib/utils";
import { AuthAlert, authButton, authLink } from "./AuthShell";

const J = copy.join;
const ICONS = { student: GraduationCap, faculty: BookOpen, organization: Building2 } satisfies Record<Role, unknown>;

type Values = Partial<Record<InterestField, string>>;

// Label and help for the fields that depend on the role.
function fieldText(role: Role, field: InterestField): { label: string; help?: string } {
  const F = J.fields;
  switch (field) {
    case "name":
      return { label: F.name };
    case "email":
      return role === "organization" ? { label: F.workEmail } : { label: F.email, help: F.weberHelp };
    case "note":
      return { label: `${J.notes[role]} (${F.optional.toLowerCase()})` };
    case "title":
      return { label: `${F.title} (${F.optional.toLowerCase()})` };
    default:
      return { label: F[field] };
  }
}

export function JoinForm() {
  const [role, setRole] = useState<Role>("student");
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<InterestErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sentTo, setSentTo] = useState({ name: "", email: "" });

  const set = (field: InterestField) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors((all) => ({ ...all, [field]: undefined }));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const honeypot = new FormData(e.currentTarget).get("website");
    const checked = checkInterest({ role, ...values });
    if ("errors" in checked) {
      setErrors(checked.errors);
      const first = Object.keys(checked.errors)[0];
      document.getElementById(`join-${first}`)?.focus();
      return;
    }
    setErrors({});
    setStatus("sending");
    try {
      const res = await fetch(INTEREST_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...checked.value, website: honeypot }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? J.errors.limited : J.errors.failed);
      setSentTo({ name: checked.value.name.split(" ")[0], email: checked.value.email });
      setStatus("sent");
    } catch (err) {
      setErrors({ form: err instanceof Error && err.message === J.errors.limited ? J.errors.limited : J.errors.failed });
      setStatus("idle");
    }
  };

  if (status === "sent") {
    return (
      <div role="status" className="rounded-3xl border border-black/10 p-8 text-center animate-in fade-in-0 zoom-in-95 duration-300">
        <h2 className="text-2xl font-light tracking-tight">{J.sentHeading.replace("{name}", sentTo.name)}</h2>
        <p className="mt-2 text-[15px] font-light text-black/55">{J.sentBody.replace("{email}", sentTo.email)}</p>
        <button
          type="button"
          onClick={() => {
            setValues({});
            setStatus("idle");
          }}
          className={`mt-6 cursor-pointer text-sm ${authLink}`}
        >
          {J.another}
        </button>
      </div>
    );
  }

  const fields: InterestField[] = ["name", "email", ...ROLE_FIELDS[role], "note"];

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className="mb-2 block px-5 text-[13px] leading-none font-medium text-black/70">{J.roleLabel}</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => {
            const Icon = ICONS[r];
            const on = r === role;
            return (
              <label
                key={r}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-sm transition has-focus-visible:ring-2 has-focus-visible:ring-black ${
                  on ? "border-black bg-black text-white" : "border-black/10 text-black/70 hover:border-black/25 hover:text-black"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={on}
                  onChange={() => {
                    setRole(r);
                    setErrors({});
                  }}
                  className="sr-only"
                />
                <Icon aria-hidden className="size-5" strokeWidth={1.5} />
                {J.roles[r].label}
              </label>
            );
          })}
        </div>
        <p key={role} className="mt-2.5 text-center text-xs text-black/45 animate-in fade-in-0 duration-300">
          {J.roles[role].hint}
        </p>
      </fieldset>

      <AuthAlert message={errors.form} />

      <div key={role} className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
        {fields.map((field) => {
          const id = `join-${field}`;
          const { label, help } = fieldText(role, field);
          const error = errors[field];
          const described = [help && !error && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
          const common = {
            id,
            name: field,
            value: values[field] ?? "",
            onChange: set(field),
            "aria-invalid": error ? true : undefined,
            "aria-describedby": described,
          };
          return (
            <Field key={field} id={id} label={label} help={help} error={error}>
              {field === "year" ? (
                <div className="relative">
                  <select {...common} className={cn(inputClass, "cursor-pointer appearance-none pr-12", !values.year && "text-black/35")}>
                    <option value="" disabled>
                      {J.fields.yearPlaceholder}
                    </option>
                    {YEARS.map((y) => (
                      <option key={y} value={y} className="text-ink">
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-5 size-4 -translate-y-1/2 text-black/40"
                    strokeWidth={1.75}
                  />
                </div>
              ) : field === "note" ? (
                <textarea
                  {...common}
                  rows={3}
                  maxLength={NOTE_MAX}
                  className={cn(inputClass, "field-sizing-content h-auto max-h-60 min-h-24 resize-none rounded-3xl py-3")}
                />
              ) : (
                <input
                  {...common}
                  type={field === "email" ? "email" : "text"}
                  inputMode={field === "email" ? "email" : undefined}
                  autoComplete={
                    field === "name" ? "name" : field === "email" ? "email" : field === "organization" ? "organization" : field === "title" ? "organization-title" : "off"
                  }
                  autoCapitalize={field === "email" ? "none" : undefined}
                  spellCheck={field === "email" ? false : undefined}
                  maxLength={SHORT_MAX}
                  className={inputClass}
                />
              )}
            </Field>
          );
        })}
      </div>

      {/* For bots only: hidden from people and from screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <button
        type="submit"
        disabled={status === "sending"}
        className={`${authButton} bg-black text-white hover:bg-black/80 disabled:cursor-wait disabled:opacity-70`}
      >
        {status === "sending" ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            {J.pending}
          </>
        ) : (
          J.submit
        )}
      </button>
    </form>
  );
}
