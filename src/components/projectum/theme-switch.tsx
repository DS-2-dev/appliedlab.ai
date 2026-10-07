"use client";

// Dark mode lives on <html> as shadcn's .dark class, so dialogs, menus and
// tooltips, which render outside the page, turn dark too. ThemeSync holds
// the class while Projectum is open and takes it away on leaving, so the
// rest of the site stays light. The switch in Settings flips it and
// remembers the choice for a year.
//
// Flipping it crossfades the whole page as one picture (a view
// transition), so every surface, text and button changes together rather
// than each at its own transition speed. The switch stays live above the
// fade so its thumb slides. Reduced motion, or a browser without view
// transitions, switches at once.

import * as React from "react";
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { THEME_COOKIE } from "@/components/projectum/theme";
import { Switch } from "@/components/ui/switch";

// On <html> for the length of the fade, which globals.css times.
const FADE = "theme-fade";

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeSync({ dark }: { dark: boolean }) {
  React.useLayoutEffect(() => {
    applyDark(dark);
    return () => applyDark(false);
  }, [dark]);
  return null;
}

export function DarkModeSwitch({
  initial,
  className,
  ...props
}: { initial: boolean } & React.ComponentProps<typeof Switch>) {
  // Settings is made on the server when the page loads, and the page may
  // have switched since, so once in the browser the page's own class wins.
  const [on, setOn] = React.useState(() =>
    typeof document === "undefined" ? initial : document.documentElement.classList.contains("dark"),
  );

  const change = (checked: boolean) => {
    document.cookie = `${THEME_COOKIE}=${checked ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    const commit = () => {
      flushSync(() => setOn(checked));
      applyDark(checked);
    };
    const reduce = prefersReducedMotion();
    if (!("startViewTransition" in document) || reduce) {
      commit();
      return;
    }
    const root = document.documentElement;
    root.classList.add(FADE);
    document.startViewTransition(commit).finished.finally(() => root.classList.remove(FADE));
  };

  return (
    <Switch
      {...props}
      className={cn("[view-transition-name:theme-switch]", className)}
      checked={on}
      onCheckedChange={change}
    />
  );
}
