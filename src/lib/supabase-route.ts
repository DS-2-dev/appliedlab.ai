// A Supabase client for route handlers that build their own response. Auth
// cookies the client writes (the PKCE verifier on the way out to Google, the
// session on the way back) are collected and applied to whichever response
// the handler ends up returning, along with the no-store headers Supabase
// sends so a CDN never caches one person's session for another.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export function routeClient(req: NextRequest) {
  const cookies: { name: string; value: string; options: CookieOptions }[] = [];
  const headers: Record<string, string> = {};

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list, extra) => {
          cookies.push(...list);
          Object.assign(headers, extra ?? {});
        },
      },
    },
  );

  function apply<T extends NextResponse>(res: T): T {
    cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  return { client, apply };
}
