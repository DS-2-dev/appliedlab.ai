// A page with one thing to say, in the site's frame: a title, a grey note
// under it, and the ways onward as ↳ links, in the column a tile's page
// puts its text in. The 404, the site's error page, and Projectum's.

import type { ReactNode } from "react";
import { INK, SiteFrame, at } from "@/components/home/SiteFrame";

export function MessagePage({
  kicker,
  title,
  body,
  children,
}: {
  kicker?: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <SiteFrame>
      <div className="home-rise max-w-[400px] pt-[clamp(60px,calc(100svh-520px),180px)] pb-24" style={at(1)}>
        {kicker && <p className="text-sm/4 font-semibold text-[#9a9aa1]">{kicker}</p>}
        <h1 className={`${kicker ? "mt-2" : ""} ${INK}`}>{title}</h1>
        <p className="mt-2 text-sm/[17px] font-medium text-[#737378]">{body}</p>
        <div className={`mt-8 flex flex-wrap gap-x-5 gap-y-2 ${INK}`}>{children}</div>
      </div>
    </SiteFrame>
  );
}

// The ↳ link's look, for a link or a button.
export const onward = "home-link cursor-pointer";
