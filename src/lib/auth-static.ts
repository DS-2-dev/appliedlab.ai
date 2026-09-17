// The account actions on the static site (NEXT_PUBLIC_STATIC_SITE), which
// runs no server. next.config.ts points every import of
// @/lib/auth-actions here on that build, `npm run dev` included, so the same
// pages work unchanged: each form answers that accounts open with the
// platform launch and keeps the email that was typed.

import { copy } from "@/content/copy";
import type { AuthState } from "@/lib/auth-actions";

export type { AuthField, AuthState } from "@/lib/auth-actions";

const unavailable = async (_: AuthState, data: FormData): Promise<AuthState> => ({
  errors: { form: copy.auth.staticForm },
  values: { email: String(data.get("email") ?? "") },
});

export const loginAction = unavailable;
export const forgotAction = unavailable;
export const resetAction = unavailable;

// Projectum's Settings imports this but shows no Account section here, and
// the login page offers the demo as a link, so neither runs.
export async function logoutAction(): Promise<void> {}
export async function projectumDemoAction(): Promise<void> {}
