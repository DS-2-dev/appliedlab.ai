// The GitHub Pages build's stand-in for src/lib/auth-actions.ts. Pages runs
// no server, so there are no server actions. The forms use auth-static.ts on
// that build, and Projectum's Settings still imports logoutAction but skips
// its Account section there.

import { staticActions } from "@/lib/auth-static";

export type AuthField = "name" | "email" | "password" | "form";

export interface AuthState {
  errors?: Partial<Record<AuthField, string>>;
  values?: { email?: string; name?: string };
  sent?: { email: string; devLink?: string };
}

export const { loginAction, signupAction, forgotAction, resetAction } = staticActions;

export async function logoutAction(): Promise<void> {}
export async function projectumDemoAction(): Promise<void> {}
