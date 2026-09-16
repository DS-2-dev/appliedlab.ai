import { STATUS_LABELS, type Status } from "@/content/handbook";

// The device that makes publishing an unbuilt plan honest. Status is never
// carried by color alone (brand spec §4.3): the label is always spelled out.

const STYLES: Record<Status, string> = {
  running: "border-green bg-ok-wash text-green-deep",
  fall: "border-brand bg-brand-wash text-brand-deep",
  planned: "border-line-strong bg-ground-sunken text-ink-faint",
};

export function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-0.5 font-mono text-xs whitespace-nowrap ${STYLES[status]} ${className}`}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status === "running"
            ? "bg-green-deep"
            : status === "fall"
              ? "bg-brand-deep"
              : "bg-ink-faint"
        }`}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
