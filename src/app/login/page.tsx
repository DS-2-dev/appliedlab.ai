import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { copy } from "@/content/copy";
import { devAuthAllowed, getSessionUser } from "@/lib/auth";
import { projectumDemoAction } from "@/lib/auth-actions";
import { safeNext } from "@/lib/auth-rules";
import { AuthDivider, AuthShell, DemoLink, authLink } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/AuthForms";
import { STATIC_SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${copy.auth.login.title} | ${copy.meta.title}`,
};

const E = copy.auth.errors;

// Errors that arrive on the URL, from the Google and email-link returns.
// Anything not in this list is ignored rather than echoed onto the page.
const URL_ERRORS: Record<string, string> = {
  "google-domain": E.googleDomain,
  "google-failed": E.googleFailed,
  "google-unavailable": E.googleUnavailable,
  "link-expired": E.linkExpired,
  removed: E.removed,
};

// The frame both versions of the page share, around what differs.
function LoginShell({ children }: { children: React.ReactNode }) {
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
      {children}
    </AuthShell>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // The static site is built once, with no session or query string, and
  // opens the Projectum demo in place of an account.
  if (STATIC_SITE) {
    return (
      <LoginShell>
        <GoogleButton next="/projectum" />
        <AuthDivider />
        <LoginForm next="/projectum" />
        <DemoLink />
      </LoginShell>
    );
  }

  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getSessionUser()) redirect(next);

  return (
    <LoginShell>
      <GoogleButton next={next} />
      <AuthDivider />
      <LoginForm next={next} initialError={params.error ? URL_ERRORS[params.error] : undefined} />

      {/* Local preview only: straight into /projectum as a demo account, for
          working on that page without making one. */}
      {devAuthAllowed() && (
        <form action={projectumDemoAction} className="mt-5 text-center">
          <button type="submit" className={`cursor-pointer text-sm ${authLink}`}>
            {copy.auth.projectumDemo}
          </button>
        </form>
      )}
    </LoginShell>
  );
}
