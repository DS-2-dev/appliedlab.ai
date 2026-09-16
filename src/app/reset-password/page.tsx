import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/content/copy";
import { getSessionUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/data/supabase";
import { readResetToken } from "@/lib/local-accounts";
import { AuthAlert, AuthShell, authLink } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/AuthForms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.auth.reset.title} | ${copy.meta.title}`,
};

// Reached from a reset email. With Supabase the link has already signed this
// browser in through /api/auth/callback, so a session is the proof the link
// was good. In the local preview the proof is the signed token on the URL.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = hasSupabase()
    ? Boolean(await getSessionUser())
    : Boolean(token && (await readResetToken(token)));

  return (
    <AuthShell
      heading={copy.auth.reset.heading}
      body={valid ? copy.auth.reset.body : undefined}
      footer={
        <Link href="/login" className={authLink}>
          {copy.auth.forgot.back}
        </Link>
      }
    >
      {valid ? (
        <ResetForm token={hasSupabase() ? undefined : token} />
      ) : (
        <div className="space-y-4">
          <AuthAlert message={copy.auth.reset.expired} />
          <p className="text-sm">
            <Link href="/forgot-password" className={authLink}>
              {copy.auth.reset.requestNew}
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
