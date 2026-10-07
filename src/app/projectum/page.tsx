// Projectum: the one signed-in page. Accounts live on the Cloudflare Worker
// (worker/src/accounts.ts) and the site is static, so the page is the same
// in every build and everything about the account is read in the browser
// (static-projectum.tsx). Stock shadcn (Base UI, base-nova, neutral): the
// sidebar layout from its docs with no top bar, the Lab's purple left out.

import type { Metadata } from "next";
import { copy } from "@/content/copy";
import { StaticProjectum } from "@/components/projectum/static-projectum";

export const metadata: Metadata = {
  title: `${copy.projectum.title} | ${copy.meta.title}`,
};

export default function ProjectumPage() {
  return <StaticProjectum />;
}
