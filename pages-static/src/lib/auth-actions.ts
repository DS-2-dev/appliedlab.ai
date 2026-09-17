// The GitHub Pages build's stand-in for src/lib/auth-actions.ts. Pages runs
// no server, so there are no server actions. Projectum's Settings still
// imports logoutAction but skips its Account section on the static site,
// and the sign-in pages that use the rest are left out of this build.

export type AuthField = "name" | "email" | "password" | "form";

export interface AuthState {
  errors?: Partial<Record<AuthField, string>>;
  values?: { email?: string; name?: string };
  sent?: { email: string; devLink?: string };
}

const unavailable = async (): Promise<AuthState> => ({ errors: { form: "Accounts are not open yet." } });

export const loginAction = unavailable;
export const signupAction = unavailable;
export const forgotAction = unavailable;
export const resetAction = unavailable;

export async function logoutAction(): Promise<void> {}
export async function projectumDemoAction(): Promise<void> {}
