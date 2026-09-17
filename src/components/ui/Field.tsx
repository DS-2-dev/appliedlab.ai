import type { ReactNode } from "react";

// The account forms' field: a small label above a round control, with help
// or an error under it, both tied to the control by id.

export function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {help && !error ? (
        <p id={`${id}-help`} className="mt-1.5 px-5 text-xs leading-snug text-black/45">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={errorClass}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const labelClass = "block px-5 text-[13px] leading-none font-medium text-black/70";
export const errorClass = "mt-1.5 px-5 text-xs leading-snug text-red-600";

export const inputClass =
  "h-12 w-full rounded-full border border-black/10 bg-white px-5 text-[15px] text-ink outline-none transition placeholder:text-black/35 hover:border-black/20 focus:border-black/50 focus:ring-4 focus:ring-black/[0.04] aria-invalid:border-red-400";
