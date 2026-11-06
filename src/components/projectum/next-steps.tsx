// A banner telling the viewer what to do now that the ball is in their court.

import { NEXT_STEPS, type CopyCtx } from "@/lib/pipeline/handoffs";

const TONE = { good: "green", warn: "amber", info: "blue" } as const;

export function NextSteps({ copyKey, ctx }: { copyKey: string; ctx: CopyCtx }) {
  const c = NEXT_STEPS[copyKey]?.(ctx);
  if (!c) return null;
  const tone = TONE[c.tone];
  return (
    <section
      className="grid gap-1.5 rounded-lg px-3.5 py-3 text-sm"
      style={{ backgroundColor: `var(--tone-${tone}-bg)`, color: `var(--tone-${tone}-fg)` }}
    >
      <h3 className="font-medium">{c.title}</h3>
      {c.body && <p>{c.body}</p>}
      {c.steps.length > 0 && (
        <ol className="grid list-decimal gap-1 pl-5">
          {c.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
