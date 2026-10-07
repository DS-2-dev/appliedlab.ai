// A member's public profile, at /profile?u=their-handle. The site is static,
// so the page reads the handle and the profile in the browser
// (PublicProfile). Members turn theirs on in Projectum's Settings.

import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/content/copy";
import { PublicProfile } from "@/components/profile/PublicProfile";

export const metadata: Metadata = {
  title: `${copy.projectum.pipeline.profile.pageTitle} | ${copy.meta.title}`,
};

export default function ProfilePage() {
  return (
    <Suspense>
      <PublicProfile />
    </Suspense>
  );
}
