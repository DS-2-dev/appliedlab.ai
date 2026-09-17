// The GitHub Pages stand-in for src/app/signup/page.tsx: the same screen,
// built once with no session check, pointing to the Projectum demo until
// accounts open.

import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/content/copy";
import { AuthDivider, AuthShell, authLink } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = {
  title: `${copy.auth.signup.title} | ${copy.meta.title}`,
};

export default function SignupPage() {
  return (
    <AuthShell
      heading={copy.auth.signup.heading}
      body={copy.auth.signup.body}
      footer={
        <>
          {copy.auth.signup.switchPrompt}{" "}
          <Link href="/login" className={authLink}>
            {copy.auth.signup.switchCta}
          </Link>
        </>
      }
    >
      <GoogleButton next="/projectum" enabled={false} note={copy.auth.staticGoogle} />
      <AuthDivider />
      <SignupForm />
      <p className="mt-5 text-center text-sm">
        <Link href="/projectum" className={authLink}>
          {copy.auth.staticDemo}
        </Link>
      </p>
    </AuthShell>
  );
}
