import * as React from "react"

// shadcn's hook, same name and same answer, read through useSyncExternalStore
// instead of an effect that calls setState on mount. The effect version trips
// react-hooks/set-state-in-effect in this project's lint, and the store
// version also skips the extra render. The server snapshot is false, which is
// what the original returned before its effect ran.

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
