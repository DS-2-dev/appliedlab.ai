// Projectum's dark mode, kept in a cookie so the server knows it before the
// first paint. Shared by the page (server) and the switch (client).

export const THEME_COOKIE = "projectum_theme";

// Run inline at the top of the page, so a dark page never paints light
// first.
export const DARK_FIRST_PAINT = "document.documentElement.classList.add('dark')";
