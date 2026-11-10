"use client";

// Log in and sign up, by Google, by password, or by a code sent to the email
// (src/lib/account.ts). Log in takes the email first: an account with a
// password is asked for it, and any other gets a 6-digit code. A right code
// then asks for whatever the account still lacks: a name for a new address,
// and a password for any account without one. Forgot password sends a code
// and sets a new one. Sign up first asks who is joining, a student, faculty
// or an organization, and holds the email to the matching domain so people
// use the right one. The role itself comes from the address on the Worker.
// Once signed in it goes on to `next`.

import * as React from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/content/copy";
import {
  ApiError,
  type StillNeeds,
  hasPassword,
  passwordLogin,
  startLogin,
  useAccountState,
  verifyLogin,
} from "@/lib/account";
import { type AccountRole, looksLikeEmail, normalizeEmail, roleForEmail } from "@/lib/email-rules";
import { Field, describedBy, inputClass } from "@/components/ui/Field";
import { AuthAlert, AuthDivider, authButton, authLink } from "./AuthShell";
import { GoogleButton } from "./GoogleButton";
import { SubmitButton } from "./SubmitButton";

const ROLES: AccountRole[] = ["member", "rep", "partner"];

const C = copy.auth.code;
const E = copy.auth.errors;

type Step = "email" | "password" | "code" | "details";
// Which field an error belongs to. "newPassword" is the one being set.
type FieldId = "email" | "password" | "code" | "name" | "newPassword";

function errorText(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "";
  switch (code) {
    case "email":
      return E.emailInvalid;
    case "code":
      return C.errors.code;
    case "expired":
      return C.errors.expired;
    case "password":
      return C.errors.password;
    case "password-short":
      return C.errors.passwordShort;
    case "password-long":
      return C.errors.passwordLong;
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
  const [password, setPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  // A code sent from Forgot password, which sets a new one.
  const [reset, setReset] = React.useState(false);
  const [needs, setNeeds] = React.useState<StillNeeds>({ name: false, password: false });
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [error, setError] = React.useState<{ field?: FieldId; text: string } | null>(
    initialError ? { text: initialError } : null,
  );
  const [note, setNote] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Already signed in, or just signed in: on to the page asked for.
  React.useEffect(() => {
    if (account.status === "signed-in") router.replace(next);
  }, [account.status, next, router]);

  const checkedEmail = () => {
    const value = normalizeEmail(email);
    if (!value) return setError({ field: "email", text: E.emailRequired });
    if (!looksLikeEmail(value)) return setError({ field: "email", text: E.emailInvalid });
    if (role && roleForEmail(value) !== role) return setError({ field: "email", text: C.wrongEmail[role] });
    return value;
  };

  // The email step: a password if the account has one, else a code.
  const start = async () => {
    const value = checkedEmail();
    if (!value) return;
    setPending(true);
    setError(null);
    try {
      if (await hasPassword(value)) {
        setEmail(value);
        setPassword("");
        setStep("password");
        return;
      }
    } catch (e) {
      setError({ text: errorText(e) });
      return;
    } finally {
      setPending(false);
    }
    await send(false);
  };

  const send = async (forReset: boolean) => {
    const value = checkedEmail();
    if (!value) return false;
    setReset(forReset);
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

  const logIn = async () => {
    if (!password) return setError({ field: "password", text: C.errors.password });
    setPending(true);
    setError(null);
    try {
      await passwordLogin(email, password);
    } catch (e) {
      setError({ field: e instanceof ApiError && e.code === "password" ? "password" : undefined, text: errorText(e) });
    } finally {
      setPending(false);
    }
  };

  const verify = async () => {
    if (step === "details") {
      if (needs.name && !name.trim()) return setError({ field: "name", text: C.errors.name });
      if (needs.password && newPassword.length < 8) return setError({ field: "newPassword", text: C.errors.passwordShort });
    }
    setPending(true);
    setError(null);
    try {
      const result = await verifyLogin(email, code, {
        reset,
        ...(step === "details" && needs.name && { name }),
        ...(step === "details" && needs.password && { password: newPassword }),
      });
      if (result !== "signed-in") {
        setNeeds(result);
        setStep("details");
      }
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      const field: FieldId | undefined = c === "code" ? "code" : c.startsWith("password-") ? "newPassword" : undefined;
      setError({ field, text: errorText(e) });
      // A dead code sends them back for a new one.
      if (c === "expired" || c === "code") setStep("code");
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNote(null);
    if (step === "email") void start();
    else if (step === "password") void logIn();
    else void verify();
  };

  const backToEmail = () => {
    setStep("email");
    setError(null);
    setNote(null);
    setDevCode(null);
    setReset(false);
  };

  const fieldError = (field: FieldId) => (error?.field === field ? error.text : undefined);
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

      {step === "email" && (
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
      )}

      {step === "password" && (
        <>
          <p className="px-5 text-center text-sm leading-snug text-black/60">{email}</p>
          {/* The address rides along hidden so password managers pair the two. */}
          <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
          <Field id="password" label={C.passwordLabel} error={fieldError("password")}>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              aria-invalid={fieldError("password") ? true : undefined}
              aria-describedby={describedBy("password", undefined, fieldError("password"))}
            />
          </Field>
        </>
      )}

      {(step === "code" || step === "details") && (
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
              readOnly={step === "details"}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputClass} tracking-[0.4em] tabular-nums`}
              aria-invalid={fieldError("code") ? true : undefined}
              aria-describedby={describedBy("code", undefined, fieldError("code"))}
            />
          </Field>
          {step === "details" && needs.name && (
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
          {step === "details" && needs.password && (
            <>
              {!needs.name && (
                <p className="px-5 text-sm leading-snug text-black/60">{reset ? C.resetIntro : C.newPasswordIntro}</p>
              )}
              <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
              <Field id="newPassword" label={C.newPasswordLabel} help={C.passwordHelp} error={fieldError("newPassword")}>
                <input
                  id="newPassword"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus={!needs.name}
                  maxLength={200}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  aria-invalid={fieldError("newPassword") ? true : undefined}
                  aria-describedby={describedBy("newPassword", C.passwordHelp, fieldError("newPassword"))}
                />
              </Field>
            </>
          )}
        </>
      )}

      <SubmitButton
        pending={pending}
        label={
          step === "email"
            ? C.emailSubmit
            : step === "password"
              ? C.passwordSubmit
              : step === "code"
                ? C.codeSubmit
                : needs.name
                  ? C.nameSubmit
                  : C.passwordSave
        }
        pendingLabel={step === "email" ? C.emailPending : C.codePending}
      />

      {step === "password" && (
        <p className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          <button type="button" className={authLink} onClick={() => void send(true)}>
            {C.forgot}
          </button>
          <button type="button" className={authLink} onClick={() => void send(false)}>
            {C.useCode}
          </button>
          <button type="button" className={authLink} onClick={backToEmail}>
            {C.otherEmail}
          </button>
        </p>
      )}

      {(step === "code" || step === "details") && (
        <p className="flex justify-center gap-5 text-sm">
          <button
            type="button"
            className={authLink}
            onClick={async () => {
              setNote(null);
              if (await send(reset)) setNote(C.resent);
            }}
          >
            {C.resend}
          </button>
          <button type="button" className={authLink} onClick={backToEmail}>
            {C.otherEmail}
          </button>
        </p>
      )}
    </form>
  );
}
