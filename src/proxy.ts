// Keeps Supabase sessions alive (Next 16 calls this file proxy; it was
// middleware). Access tokens last an hour. Server components can read cookies
// but cannot write them, so without this the refreshed token would never
// reach the browser, and with refresh-token rotation the next request would
// present a spent token and the person would be signed out mid-visit.
//
// This refreshes and writes the cookies before any page renders. It is an
// optimistic layer only: every protected page and route still checks the
// session itself (lib/auth.ts). With no Supabase configured it does nothing.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        // Written to the request too, so the page rendering behind this sees
        // the fresh session rather than the one that just expired.
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  await client.auth.getUser();
  return response;
}

export const config = {
  // Everything except build assets and static files, which never carry a
  // session worth refreshing.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
