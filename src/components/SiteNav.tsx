// The header's server half. It reads the session so the header can show
// Dashboard instead of Log in without a flash of the wrong state on load,
// which a client-side check would cause. Everything else lives in
// SiteNavClient.
//
// Reading cookies makes each page that renders the header dynamic. The pages
// already were, or were cheap enough that it does not matter at this scale.

import { getSessionUser } from "@/lib/auth";
import { SiteNavClient } from "./SiteNavClient";

export async function SiteNav() {
  const user = await getSessionUser();
  return <SiteNavClient signedIn={Boolean(user)} />;
}
