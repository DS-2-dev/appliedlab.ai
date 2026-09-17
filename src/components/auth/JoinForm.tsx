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
import { BookOpen, Building2, ChevronDown, GraduationCap } from "lucide-react";
import { copy } from "@/content/copy";
import { Field, describedBy, inputClass, labelClass } from "@/components/ui/Field";
import {
  NOTE_MAX,
  ROLE_FIELDS,
  ROLES,
  SHORT_MAX,
  YEARS,
  checkInterest,
  type Interest,
  type InterestErrors,
  type InterestField,
  type Role,
} from "@/lib/interest";
import { INTEREST_URL } from "@/lib/site";
import { cn } from "@/lib/utils";
import { AuthAlert, Sent, authLink } from "./AuthShell";
import { SubmitButton } from "./SubmitButton";

const J = copy.join;
const F = J.fields;
const ICONS = { student: GraduationCap, faculty: BookOpen, organization: Building2 } satisfies Record<Role, unknown>;
const AUTOCOMPLETE: Partial<Record<InterestField, string>> = {
  name: "name",
  email: "email",
  organization: "organization",
  title: "organization-title",
};

const optional = (label: string) => `${label} (${F.optional.toLowerCase()})`;

// A field's label, and its help where it has one, for the chosen role.
function fieldText(role: Role, field: InterestField): { label: string; help?: string } {
  if (field === "note") return { label: optional(J.notes[role]) };
  if (field === "title") return { label: optional(F.title) };
  if (field !== "email") return { label: F[field] };
  return role === "organization" ? { label: F.workEmail } : { label: F.email, help: F.weberHelp };
}

export function JoinForm() {
  const [role, setRole] = useState<Role>("student");
  const [values, setValues] = useState<Partial<Record<InterestField, string>>>({});
  const [errors, setErrors] = useState<InterestErrors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Interest | null>(null);

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
      document.getElementById(`join-${Object.keys(checked.errors)[0]}`)?.focus();
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const res = await fetch(INTEREST_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...checked.value, website: honeypot }),
      });
      if (res.ok) setSent(checked.value);
      else setErrors({ form: res.status === 429 ? J.errors.limited : J.errors.failed });
    } catch {
      setErrors({ form: J.errors.failed });
    }
    setSending(false);
  };

  if (sent) {
    return (
      <Sent
        heading={J.sentHeading.replace("{name}", sent.name.split(" ")[0])}
        body={J.sentBody.replace("{email}", sent.email)}
      >
        <button
          type="button"
          onClick={() => {
            setValues({});
            setSent(null);
          }}
          className={`mt-6 cursor-pointer text-sm ${authLink}`}
        >
          {J.another}
        </button>
      </Sent>
    );
  }

  const fields: InterestField[] = ["name", "email", ...ROLE_FIELDS[role], "note"];

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className={cn(labelClass, "mb-2")}>{J.roleLabel}</legend>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => {
            const Icon = ICONS[r];
            const on = r === role;
            return (
              <label
                key={r}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-sm transition has-focus-visible:ring-2 has-focus-visible:ring-black",
                  on ? "border-black bg-black text-white" : "border-black/10 text-black/70 hover:border-black/25 hover:text-black",
                )}
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
          const common = {
            id,
            name: field,
            value: values[field] ?? "",
            onChange: set(field),
            "aria-invalid": error ? true : undefined,
            "aria-describedby": describedBy(id, help, error),
          };
          const isEmail = field === "email";
          return (
            <Field key={field} id={id} label={label} help={help} error={error}>
              {field === "year" ? (
                <div className="relative">
                  <select {...common} className={cn(inputClass, "cursor-pointer appearance-none pr-12", !values.year && "text-black/35")}>
                    <option value="" disabled>
                      {F.yearPlaceholder}
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
                  type={isEmail ? "email" : "text"}
                  inputMode={isEmail ? "email" : undefined}
                  autoCapitalize={isEmail ? "none" : undefined}
                  spellCheck={isEmail ? false : undefined}
                  autoComplete={AUTOCOMPLETE[field] ?? "off"}
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

      <SubmitButton label={J.submit} pendingLabel={J.pending} pending={sending} />
    </form>
  );
}
