// The GitHub Pages copy of src/app/forgot-password/page.tsx, unchanged: the
// original is removed with the other server routes, and this puts it back
// so Log in's link has somewhere to go. Its form answers from the stub.

import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/content/copy";
import { AuthShell, authLink } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = {
  title: `${copy.auth.forgot.title} | ${copy.meta.title}`,
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      heading={copy.auth.forgot.heading}
      body={copy.auth.forgot.body}
      footer={
        <Link href="/login" className={authLink}>
          {copy.auth.forgot.back}
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
