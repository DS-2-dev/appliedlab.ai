import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { copy } from "@/content/copy";
import { getSessionUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/data/supabase";
import { AuthDivider, AuthShell, DemoLink, authLink } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { SignupForm } from "@/components/auth/AuthForms";
import { STATIC_SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.auth.signup.title} | ${copy.meta.title}`,
};

export default async function SignupPage() {
  if (!STATIC_SITE && (await getSessionUser())) redirect("/projectum");

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
      {/* Google creates the account on first sign-in, so the same button
          serves both pages. */}
      <GoogleButton
        next="/projectum"
        enabled={!STATIC_SITE && hasSupabase()}
        note={STATIC_SITE ? copy.auth.staticGoogle : undefined}
      />
      <AuthDivider />
      <SignupForm />
      {STATIC_SITE && <DemoLink />}
    </AuthShell>
  );
}
