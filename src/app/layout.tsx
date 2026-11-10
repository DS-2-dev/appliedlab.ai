import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono, Geist } from "next/font/google";
import { copy } from "@/content/copy";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DARK_FIRST_PAINT, THEME_COOKIE } from "@/components/projectum/theme";

// shadcn's face (2026-09-11), scoped to the Projectum app by .projectum-ui in
// globals.css. The rest of the site keeps Inter.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

// The site's face (design/STYLE.md), set with the font-archivo class.
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo-face" });

// The base body face, under font-archivo and outside Projectum.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
};

// Projectum's saved dark theme, applied before the first paint when a page
// load lands on it. It lives here because the root layout is only rendered
// into the HTML: React won't run a script a client navigation renders, and
// warns about one, so arriving by navigation is left to ThemeSync
// (projectum-view.tsx).
const DARK_IF_SAVED = `if(location.pathname.startsWith("/projectum")&&document.cookie.split("; ").includes("${THEME_COOKIE}=dark")){${DARK_FIRST_PAINT}}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Projectum's dark mode adds a class here before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable, jetbrains.variable, geist.variable, archivo.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: DARK_IF_SAVED }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
