// Log in, and sign up too: one form for every account, by a code sent to the
// email (CodeLoginForm). A new address is asked for a name and gets its
// account, with the role its domain gives it.

import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/content/copy";
import { AuthShell } from "@/components/auth/AuthShell";
import { CodeLoginRoute } from "@/components/auth/CodeLoginRoute";

export const metadata: Metadata = {
  title: `${copy.auth.login.title} | ${copy.meta.title}`,
};

export default function LoginPage() {
  return (
    <AuthShell heading={copy.auth.code.heading} body={copy.auth.code.body}>
      <Suspense>
        <CodeLoginRoute />
      </Suspense>
    </AuthShell>
  );
}
