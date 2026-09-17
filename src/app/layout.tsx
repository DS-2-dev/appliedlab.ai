import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono, Geist } from "next/font/google";
import { copy } from "@/content/copy";
import "./globals.css";
import { cn } from "@/lib/utils";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Projectum's dark mode adds a class here before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable, jetbrains.variable, geist.variable, archivo.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
