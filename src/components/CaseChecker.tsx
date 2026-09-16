"use client";

// Three yes/no questions that tell an organization whether what they have is
// a case. Quiet by design: no score, no gate, just an honest answer.

import { useState } from "react";
import { copy } from "@/content/copy";

const C = copy.partners.checker;

type Answer = boolean | null;

export function CaseChecker() {
  const [answers, setAnswers] = useState<Answer[]>([null, null, null]);

  const set = (i: number, v: boolean) =>
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });

  const complete = answers.every((a) => a !== null);
  const allYes = complete && answers.every((a) => a === true);
  const anyNo = answers.some((a) => a === false);
  const verdict = allYes ? C.allYes : anyNo ? C.someNo : C.idle;

  return (
    <div className="border border-line bg-ground-raised p-5 md:p-6">
      <h3 className="display text-xl">{C.heading}</h3>
      <p className="mt-1 text-sm text-ink-soft">{C.intro}</p>

      <ul className="mt-4 space-y-3">
        {C.questions.map((q, i) => (
          <li key={q} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[0.9375rem]">{q}</span>
            <span className="flex gap-1.5" role="group" aria-label={q}>
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={answers[i] === v}
                  onClick={() => set(i, v)}
                  className={`rounded-full border px-3.5 py-1 text-sm transition-colors ${
                    answers[i] === v
                      ? "border-brand-deep bg-brand-wash text-ink"
                      : "border-line-strong bg-ground text-ink-soft hover:border-brand-deep"
                  }`}
                >
                  {v ? C.yes : C.no}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <p
        role="status"
        className={`mt-5 border px-4 py-3 text-sm ${
          allYes
            ? "border-green bg-ok-wash text-green-deep"
            : anyNo
              ? "border-line bg-ground text-ink-soft"
              : "border-line bg-ground text-ink-faint"
        }`}
      >
        {verdict}
      </p>
    </div>
  );
}
