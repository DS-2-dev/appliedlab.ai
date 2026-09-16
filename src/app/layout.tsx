import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono, Geist } from "next/font/google";
import { copy } from "@/content/copy";
import "./globals.css";
import { cn } from "@/lib/utils";

// shadcn's face (2026-09-11), scoped to the Projectum app by .projectum-ui in
// globals.css. The rest of the site keeps Inter.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });


/* Body face. Stands in for cursor.com's proprietary CursorGothic. The UI and
   display faces (basic-sans, Goudy Bookletter 1911) come from the Typekit kit
   imported at the top of globals.css. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Projectum's dark mode adds a class here before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable, sourceSerif.variable, jetbrains.variable, geist.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
