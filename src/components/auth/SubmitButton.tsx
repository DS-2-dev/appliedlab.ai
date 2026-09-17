"use client";

// The primary button on every account form. It reads the enclosing form's
// pending state, so it disables itself and says what is happening the moment
// the form is sent, which stops double submits on a slow connection.

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { authButton } from "./AuthShell";

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${authButton} bg-black text-white hover:bg-black/80 disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? (
        <>
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}
