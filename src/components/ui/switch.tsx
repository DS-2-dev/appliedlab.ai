"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-4 w-9 shrink-0 cursor-pointer appearance-none items-center rounded-full border-0 bg-transparent bg-[length:100px_100%] bg-no-repeat p-px shadow-[inset_0_0_0_1px_oklch(0_0_0/0.05),inset_0_1.5px_2px_oklch(0_0_0/0.1)] [--switch-color:var(--color-primary)] dark:[--switch-color:var(--color-blue-500)] [--switch-muted:color-mix(in_oklch,var(--color-muted-foreground)_20%,transparent)] [background-image:linear-gradient(to_right,var(--switch-color)_35%,var(--switch-muted)_65%)] [background-position-x:100%] transition-[background-position,box-shadow] duration-125 ease-[cubic-bezier(.26,.75,.38,.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:[background-position-x:0%] data-checked:duration-250 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none h-3.5 w-5 rounded-full bg-white shadow-[0_0_1px_1px_oklch(0_0_0/0.08),0_1px_1px_oklch(0_0_0/0.12),1px_2px_4px_-1px_oklch(0_0_0/0.18)] [translate:0_0] transition-[translate] duration-125 ease-[cubic-bezier(.26,.75,.38,.45)] data-checked:[translate:--spacing(3.5)_0] data-checked:duration-250"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
