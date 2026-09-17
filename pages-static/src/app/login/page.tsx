// The GitHub Pages stand-in for src/app/login/page.tsx: the same screen,
// built once with no session check. Submitting answers with the note from
// the auth-actions stub, and a link opens the Projectum demo.

import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/content/copy";
import { AuthDivider, AuthShell, authLink } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = {
  title: `${copy.auth.login.title} | ${copy.meta.title}`,
};

export default function LoginPage() {
  return (
    <AuthShell
      heading={copy.auth.login.heading}
      body={copy.auth.login.body}
      footer={
        <>
          {copy.auth.login.switchPrompt}{" "}
          <Link href="/signup" className={authLink}>
            {copy.auth.login.switchCta}
          </Link>
        </>
      }
    >
      <GoogleButton next="/projectum" enabled={false} note={copy.auth.staticGoogle} />
      <AuthDivider />
      <LoginForm next="/projectum" />
      <p className="mt-5 text-center text-sm">
        <Link href="/projectum" className={authLink}>
          {copy.auth.staticDemo}
        </Link>
      </p>
    </AuthShell>
  );
}
