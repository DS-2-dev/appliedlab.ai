// Moved to Arch (2026-11-16). See components/forward/ForwardTo.tsx.

import type { Metadata } from "next";
import { ForwardTo } from "@/components/forward/ForwardTo";

export const metadata: Metadata = { title: "The Lab", robots: { index: false } };

export default function Page() {
  return <ForwardTo href="/login" />;
}
