"use client";

// Fades its content in, rising a little, the first time it scrolls into
// view. Quick on purpose: the landing's sections are tall and mostly white,
// so the arrival is what carries the page from one to the next. Content is
// visible from the start for anyone who asks for reduced motion.

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={el} data-shown={shown || undefined} className={`reveal ${className ?? ""}`}>
      {children}
    </div>
  );
}
