import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { copy } from "@/content/copy";
import { getSessionUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/data/supabase";
import { AuthDivider, AuthShell, authLink } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { SignupForm } from "@/components/auth/AuthForms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.auth.signup.title} | ${copy.meta.title}`,
};

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/projectum");

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
      <GoogleButton next="/projectum" enabled={hasSupabase()} />
      <AuthDivider />
      <SignupForm />
    </AuthShell>
  );
}
