import Link from "next/link";
import { copy } from "@/content/copy";

export default function NotFound() {
  return (
    <main className="flex grow flex-col items-center justify-center px-5 py-32 text-center">
      <p className="font-mono text-sm text-ink-faint">404</p>
      <h1 className="display mt-3 text-3xl">{copy.notFound.line}</h1>
      <Link
        href="/"
        className="mt-6 font-medium text-brand-deep underline-offset-4 hover:underline"
      >
        {copy.notFound.cta}
      </Link>
    </main>
  );
}
