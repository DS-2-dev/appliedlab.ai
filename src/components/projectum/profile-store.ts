"use client";

// The signed-in person's profile picture, saved on their account
// (src/lib/account.ts), so it follows them to any device. Only inline images
// are accepted, by the Worker too, so a stored value can never point the
// page somewhere else.

import * as React from "react";
import { updateAccount, useAccountState } from "@/lib/account";

export function useAvatar() {
  const s = useAccountState();
  const src = s.status === "signed-in" ? s.account.avatar : null;
  const set = React.useCallback((value: string | null) => updateAccount({ avatar: value }), []);
  return [src, set] as const;
}
