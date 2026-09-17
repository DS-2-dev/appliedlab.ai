// Whether the visitor asked for reduced motion. Browser only.
export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
