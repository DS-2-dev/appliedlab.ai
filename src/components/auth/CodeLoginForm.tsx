"use client";

// Log in and sign up in one form, by a code sent to the email
// (src/lib/account.ts). Three steps: the email, then the 6-digit code, then,
// for a new address only, a name. The role comes from the address on the
// Worker, so nobody picks one here. Once signed in it goes on to `next`.

import * as React from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy";
import { ApiError, startLogin, useAccountState, verifyLogin } from "@/lib/account";
import { looksLikeEmail, normalizeEmail } from "@/lib/email-rules";
import { Field, describedBy, inputClass } from "@/components/ui/Field";
import { AuthAlert, authLink } from "./AuthShell";
import { SubmitButton } from "./SubmitButton";

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

export function CodeLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const account = useAccountState();
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [error, setError] = React.useState<{ field?: Step; text: string } | null>(null);
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

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <AuthAlert message={formError} />

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
