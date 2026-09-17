// The account forms' actions on the static site (NEXT_PUBLIC_STATIC_SITE),
// which runs no server: every form answers that accounts open with the
// platform launch and keeps what was typed. AuthForms picks these over
// auth-actions.ts, and the GitHub Pages build swaps auth-actions.ts for a
// stub built on them (pages-static/).

import { copy } from "@/content/copy";
import type { AuthState } from "@/lib/auth-actions";

const unavailable = async (_: AuthState, data: FormData): Promise<AuthState> => ({
  errors: { form: copy.auth.staticForm },
  values: { email: String(data.get("email") ?? ""), name: String(data.get("name") ?? "") },
});

export const staticActions = {
  loginAction: unavailable,
  forgotAction: unavailable,
  resetAction: unavailable,
};
