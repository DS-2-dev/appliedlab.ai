import type { ReactNode } from "react";

// Shared accessible field structure. Public forms theme it with CSS variables;
// admin forms use the light defaults.

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
      <label htmlFor={id} className="form-label block font-sans text-sm font-medium leading-none">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {help ? (
        <p id={`${id}-help`} className="form-help mt-1.5 text-sm leading-snug">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="form-error mt-1.5 flex items-center gap-1 text-sm text-error">
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8v5m0 3v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// The control itself. `min-h` rather than a fixed height, because the same
// class also dresses textareas. The quiet ring keeps focus visible without
// turning the field into a brand-colour event.
export const inputClass =
  "form-control min-h-11 w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 font-sans text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.08)]";
