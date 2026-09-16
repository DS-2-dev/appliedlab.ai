// The partner pipeline as five numbered stops. Step one is a real link to the
// form below; the "start here" tag hangs over it. Static on purpose: this one
// is a promise, not a demo.

import { copy } from "@/content/copy";
import Link from "next/link";
import { ArrowDown } from "lucide-react";

const STEPS = copy.partners.steps;

export function PartnerSteps() {
  return (
    <div>
      {/* Desktop */}
      <div className="relative hidden md:block">
        <div aria-hidden className="absolute left-[10%] right-[10%] top-[4.4rem] h-0.5 bg-line-strong" />
        <ol className="relative grid grid-cols-5 gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="text-center">
              <div className="flex h-8 items-end justify-center">
                {i === 0 && (
                  <span className="inline-flex items-center gap-1 bg-green-deep px-2.5 py-0.5 font-mono text-xs text-ground">
                    {copy.partners.youAreHere}
                    <ArrowDown aria-hidden className="size-3 shrink-0" />
                  </span>
                )}
              </div>
              <div className="mt-2 flex justify-center">
                {i === 0 ? (
                  <Link
                    href={copy.partners.ask.href}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-deep bg-brand font-mono text-sm font-semibold text-ground transition-transform hover:scale-110"
                  >
                    <span className="sr-only">{step.title}: </span>1
                  </Link>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-line-strong bg-ground font-mono text-sm text-ink-soft">
                    {i + 1}
                  </span>
                )}
              </div>
              <p className="mt-3 font-medium leading-snug">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.note}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Mobile */}
      <ol className="md:hidden">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0">
            {i < STEPS.length - 1 && (
              <span aria-hidden className="absolute left-[15px] top-9 h-full w-px bg-line-strong" />
            )}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm ${
                i === 0
                  ? "border-brand-deep bg-brand font-semibold text-ground"
                  : "border-line-strong bg-ground text-ink-soft"
              }`}
            >
              {i + 1}
            </span>
            <div className="pt-0.5">
              <p className="font-medium">
                {step.title}
                {i === 0 && (
                  <span className="ml-2 bg-green-deep px-2 py-0.5 font-mono text-xs text-ground">
                    {copy.partners.youAreHere}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{step.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
