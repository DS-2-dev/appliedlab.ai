import Link from "next/link";
import { copy } from "@/content/copy";
import { StarMark } from "@/components/StarMark";

export default function NotFound() {
  return (
    <main className="font-archivo flex grow flex-col items-center justify-center bg-white px-5 py-32 text-center text-ink">
      <StarMark className="w-12" />
      <p className="kicker mt-6 opacity-35">404</p>
      <h1 className="mt-3 text-3xl font-light tracking-tight">{copy.notFound.line}</h1>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center rounded-full bg-black px-5 text-sm text-white transition hover:bg-black/80"
      >
        {copy.notFound.cta}
      </Link>
    </main>
  );
}
