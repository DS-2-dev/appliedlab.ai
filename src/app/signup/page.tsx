// Sign up is Join the Lab: a form, not an account. Students, faculty and
// organizations each leave their details, and the Lab follows up by email.
// Accounts come with the platform launch.

import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/content/copy";
import { AuthShell, DemoLink, authLink } from "@/components/auth/AuthShell";
import { JoinForm } from "@/components/auth/JoinForm";
import { STATIC_SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `${copy.join.title} | ${copy.meta.title}`,
};

export default function SignupPage() {
  return (
    <AuthShell
      wide
      heading={copy.join.heading}
      body={copy.join.body}
      footer={
        <>
          {copy.auth.signup.switchPrompt}{" "}
          <Link href="/login" className={authLink}>
            {copy.auth.signup.switchCta}
          </Link>
        </>
      }
    >
      <JoinForm />
      {STATIC_SITE && <DemoLink />}
    </AuthShell>
  );
}
