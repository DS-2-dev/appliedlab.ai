"use client";

// Log in and sign up, by Google or by a code sent to the email
// (src/lib/account.ts). The code takes three steps: the email, then the
// 6-digit code, then, for a new address only, a name. Sign up first asks who
// is joining, a student, faculty or an organization, and holds the email to
// the matching domain so people use the right one. The role itself comes
// from the address on the Worker. Once signed in it goes on to `next`.

import * as React from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy";
import { ApiError, startLogin, useAccountState, verifyLogin } from "@/lib/account";
import { type AccountRole, looksLikeEmail, normalizeEmail, roleForEmail } from "@/lib/email-rules";
import { Field, describedBy, inputClass } from "@/components/ui/Field";
import { AuthAlert, AuthDivider, authButton, authLink } from "./AuthShell";
import { GoogleButton } from "./GoogleButton";
import { SubmitButton } from "./SubmitButton";

const ROLES: AccountRole[] = ["member", "rep", "partner"];

const C = copy.auth.code;
const E = copy.auth.errors;

type Step = "email" | "code" | "name";

function errorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "";
  switch (code) {
    case "email":
      return E.emailInvalid;
    case "code":
      return C.errors.code;
    case "expired":
      return C.errors.expired;
    case "limited":
      return E.rateLimited;
    case "removed":
      return E.removed;
    case "email-unavailable":
      return C.errors.emailUnavailable;
    case "network":
      return C.errors.network;
    default:
      return E.generic;
  }
}

export function CodeLoginForm({
  next,
  signup = false,
  initialError,
  initialRole = null,
}: {
  next: string;
  signup?: boolean;
  initialError?: string;
  initialRole?: AccountRole | null;
}) {
  const router = useRouter();
  const account = useAccountState();
  // Sign up's pick, null until chosen. Log in never asks.
  const [role, setRole] = React.useState<AccountRole | null>(initialRole);
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [error, setError] = React.useState<{ field?: Step; text: string } | null>(
    initialError ? { text: initialError } : null,
  );
  const [note, setNote] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Already signed in, or just signed in: on to the page asked for.
  React.useEffect(() => {
    if (account.status === "signed-in") router.replace(next);
  }, [account.status, next, router]);

  const send = async () => {
    const value = normalizeEmail(email);
    if (!value) return setError({ field: "email", text: E.emailRequired });
    if (!looksLikeEmail(value)) return setError({ field: "email", text: E.emailInvalid });
    if (role && roleForEmail(value) !== role) return setError({ field: "email", text: C.wrongEmail[role] });
    setPending(true);
    setError(null);
    try {
      const res = await startLogin(value);
      setEmail(value);
      setDevCode(res.devCode ?? null);
      setCode("");
      setStep("code");
      return true;
    } catch (e) {
      setError({ text: errorText(e) });
      return false;
    } finally {
      setPending(false);
    }
  };

  const verify = async () => {
    if (step === "name" && !name.trim()) return setError({ field: "name", text: C.errors.name });
    setPending(true);
    setError(null);
    try {
      const result = await verifyLogin(email, code, step === "name" ? name : undefined);
      if (result === "needs-name") setStep("name");
    } catch (e) {
      const text = errorText(e);
      setError({ field: e instanceof ApiError && e.code === "code" ? "code" : undefined, text });
      // A dead code sends them back for a new one.
      if (e instanceof ApiError && e.code === "expired") setStep("code");
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNote(null);
    if (step === "email") void send();
    else void verify();
  };

  const fieldError = (field: Step) => (error?.field === field ? error.text : undefined);
  const formError = error && !error.field ? error.text : undefined;

  if (signup && !role) {
    return (
      <div className="space-y-4">
        <AuthAlert message={formError} />
        <p className="px-5 text-[13px] leading-none font-medium text-black/70">{C.rolePrompt}</p>
        <div role="group" aria-label={C.rolePrompt} className="grid gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r);
                setError(null);
              }}
              className={`${authButton} border border-black/10 bg-white text-ink hover:border-black/20 hover:bg-black/[0.03]`}
            >
              {C.roles[r].label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {role && step === "email" && (
        <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-black/[0.04] px-5 py-3 text-sm">
          <span>
            <span className="font-medium">{C.roles[role].label}.</span>{" "}
            <span className="text-black/60">{C.roles[role].hint}</span>
          </span>
          <button
            type="button"
            className={authLink}
            onClick={() => {
              setRole(null);
              setError(null);
            }}
          >
            {C.changeRole}
          </button>
        </div>
      )}
      <AuthAlert message={formError} />

      {step === "email" && (
        <>
          <GoogleButton next={next} role={role} />
          <AuthDivider />
        </>
      )}

      {step === "email" ? (
        <Field id="email" label={copy.auth.fields.email.label} error={fieldError("email")}>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            aria-invalid={fieldError("email") ? true : undefined}
            aria-describedby={describedBy("email", undefined, fieldError("email"))}
          />
        </Field>
      ) : (
        <>
          <p role="status" className="px-5 text-center text-sm leading-snug text-black/60">
            {C.codeSent.replace("{email}", email)}
          </p>
          {devCode && (
            <p className="px-5 text-center text-xs text-black/45">{C.devNote.replace("{code}", devCode)}</p>
          )}
          {note && <p className="px-5 text-center text-xs text-black/45">{note}</p>}
          <Field id="code" label={C.codeLabel} error={fieldError("code")}>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus={step === "code"}
              readOnly={step === "name"}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputClass} tracking-[0.4em] tabular-nums`}
              aria-invalid={fieldError("code") ? true : undefined}
              aria-describedby={describedBy("code", undefined, fieldError("code"))}
            />
          </Field>
          {step === "name" && (
            <>
              <p className="px-5 text-sm leading-snug text-black/60">{C.nameIntro}</p>
              <Field id="name" label={C.nameLabel} help={C.nameHelp} error={fieldError("name")}>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  autoFocus
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  aria-invalid={fieldError("name") ? true : undefined}
                  aria-describedby={describedBy("name", C.nameHelp, fieldError("name"))}
                />
              </Field>
            </>
          )}
        </>
      )}

      <SubmitButton
        pending={pending}
        label={step === "email" ? C.emailSubmit : step === "code" ? C.codeSubmit : C.nameSubmit}
        pendingLabel={step === "email" ? C.emailPending : C.codePending}
      />

      {step !== "email" && (
        <p className="flex justify-center gap-5 text-sm">
          <button
            type="button"
            className={authLink}
            onClick={async () => {
              setNote(null);
              if (await send()) setNote(C.resent);
            }}
          >
            {C.resend}
          </button>
          <button
            type="button"
            className={authLink}
            onClick={() => {
              setStep("email");
              setError(null);
              setNote(null);
              setDevCode(null);
            }}
          >
            {C.otherEmail}
          </button>
        </p>
      )}
    </form>
  );
}
