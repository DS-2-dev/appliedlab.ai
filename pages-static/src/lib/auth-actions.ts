// The GitHub Pages build's stand-in for src/lib/auth-actions.ts. Pages runs
// no server, so there are no server actions. Projectum's Settings still
// imports logoutAction but skips its Account section on the static site,
// and the stand-in Log in, Sign up and reset request pages get the note
// below when their forms are sent.

import { copy } from "@/content/copy";

export type AuthField = "name" | "email" | "password" | "form";

export interface AuthState {
  errors?: Partial<Record<AuthField, string>>;
  values?: { email?: string; name?: string };
  sent?: { email: string; devLink?: string };
}

const unavailable = async (_: AuthState, data: FormData): Promise<AuthState> => ({
  errors: { form: copy.auth.staticForm },
  values: { email: String(data.get("email") ?? ""), name: String(data.get("name") ?? "") },
});

export const loginAction = unavailable;
export const signupAction = unavailable;
export const forgotAction = unavailable;
export const resetAction = unavailable;

export async function logoutAction(): Promise<void> {}
export async function projectumDemoAction(): Promise<void> {}
