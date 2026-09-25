"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
    const mql = window.matchMedia(QUERY);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
    return window.matchMedia(QUERY).matches;
}

/* The server has no media queries, so it assumes motion is allowed. Nothing
   gated on this hook renders DOM of its own — Lenis's root provider emits no
   element, and the canvas is client-only — so the server and client markup
   agree either way and hydration stays clean. */
function getServerSnapshot() {
    return false;
}

/* useSyncExternalStore rather than useState + useEffect on purpose.

   An effect-based version returns a placeholder on the first render and the
   real value a tick later. Everything here is gated on that value, so the flip
   would tear down and rebuild the whole subtree immediately after mount. This
   resolves during the first client render instead — one value, no remount. */
export function useReducedMotion() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
