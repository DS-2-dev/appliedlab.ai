import type { ReactNode } from "react";

// The account forms' field: a label above a plain control in the site's
// frame (Inter at 14px, a hairline border, 8px corners), with help or an
// error under it, both tied to the control by id.

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
        <p id={`${id}-help`} className="mt-1.5 text-xs/[14px] font-medium text-[#9a9aa1]">
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

// The ids a control points at with aria-describedby, matching what Field
// shows: the help, or the error in its place.
export function describedBy(id: string, help?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  return help ? `${id}-help` : undefined;
}

export const labelClass = "block text-sm/4 font-semibold text-[#1f1f1f]";
export const errorClass = "mt-1.5 text-xs/[14px] font-medium text-[#c8321e]";

export const inputClass =
  "h-10 w-full rounded-lg border border-[#e4e4e4] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none transition-colors placeholder:text-[#9a9aa1] hover:border-[#cfcfcf] focus:border-[#1f1f1f] aria-invalid:border-[#c8321e]";
