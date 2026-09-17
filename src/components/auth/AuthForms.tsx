"use client";

// The three account forms. Each posts to its server action through
// useActionState, so errors come back into the same form without a page
// load, and the form still submits normally if JavaScript has not loaded.
//
// `noValidate` turns off the browser's own bubbles: the server's messages
// are the ones people see, in the site's type, next to the field they are
// about. Inputs are uncontrolled with defaultValue from the returned state,
// so after React resets the form on submit the email survives and the
// password, correctly, does not.

import Link from "next/link";
import { useActionState } from "react";
import { copy } from "@/content/copy";
import { Field, describedBy, errorClass, inputClass, labelClass } from "@/components/ui/Field";
import { forgotAction, loginAction, resetAction, type AuthState } from "@/lib/auth-actions";
import { AuthAlert, Sent, authLink } from "./AuthShell";
import { PasswordInput } from "./PasswordInput";
import { SubmitButton } from "./SubmitButton";

const A = copy.auth;
const F = A.fields;


function EmailField({ state }: { state: AuthState }) {
  const error = state.errors?.email;
  return (
    <Field id="email" label={F.email.label} error={error}>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.values?.email}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy("email", undefined, error)}
      />
    </Field>
  );
}

// --- Log in -----------------------------------------------------------------

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  const e = state.errors ?? {};
  // An error carried in on the URL (a failed Google return) shows until the
  // first submit replaces it.
  const formError = e.form ?? (state.values ? undefined : initialError);

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <AuthAlert message={formError} />
      <EmailField state={state} />

      <div>
        <div className="flex items-baseline justify-between gap-4 pr-5">
          <label htmlFor="password" className={labelClass}>
            {F.password.label}
          </label>
          <Link href="/forgot-password" className="text-[13px] leading-none text-black/50 transition hover:text-black">
            {A.login.forgot}
          </Link>
        </div>
        <div className="mt-2">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            invalid={Boolean(e.password)}
            describedBy={describedBy("password", undefined, e.password)}
          />
        </div>
        {e.password && (
          <p id="password-error" className={errorClass}>
            {e.password}
          </p>
        )}
      </div>

      <SubmitButton label={A.login.submit} pendingLabel={A.login.pending} />
    </form>
  );
}

// --- Forgot password --------------------------------------------------------

export function ForgotForm() {
  const [state, action] = useActionState<AuthState, FormData>(forgotAction, {});

  if (state.sent) {
    return (
      <Sent
        heading={A.forgot.sentHeading}
        body={A.forgot.sentBody.replace("{email}", state.sent.email)}
      >
        {state.sent.devLink && (
          <p className="mt-4 text-sm text-black/45">
            {A.forgot.devNote}{" "}
            <Link href={state.sent.devLink} className={authLink}>
              {A.forgot.devLink}
            </Link>
          </p>
        )}
      </Sent>
    );
  }

  return (
    <form action={action} noValidate className="space-y-4">
      <AuthAlert message={state.errors?.form} />
      <EmailField state={state} />
      <SubmitButton label={A.forgot.submit} pendingLabel={A.forgot.pending} />
    </form>
  );
}

// --- Reset password ---------------------------------------------------------

export function ResetForm({ token }: { token?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(resetAction, {});
  const e = state.errors ?? {};

  return (
    <form action={action} noValidate className="space-y-4">
      {token && <input type="hidden" name="token" value={token} />}
      <AuthAlert message={e.form} />
      {e.form === A.errors.linkExpired && (
        <p className="text-center text-sm">
          <Link href="/forgot-password" className={authLink}>
            {A.reset.requestNew}
          </Link>
        </p>
      )}
      <Field id="password" label={F.newPassword.label} help={F.newPassword.help} error={e.password}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          invalid={Boolean(e.password)}
          describedBy={describedBy("password", F.newPassword.help, e.password)}
        />
      </Field>
      <SubmitButton label={A.reset.submit} pendingLabel={A.reset.pending} />
    </form>
  );
}
