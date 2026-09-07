"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/* The theme lives on <html data-theme>, set by the blocking script in
   layout.tsx before first paint and flipped by ThemeToggle. Neither publishes
   an event, so observing the attribute is the only way to follow it without
   lifting theme into React state, which would leave it a tick behind the DOM. */
function subscribe(onChange: () => void) {
    const mo = new MutationObserver(onChange);
    mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
}

function getSnapshot(): Theme {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/* The server cannot know the visitor's theme. "dark" here matches the
   fallback the blocking script uses when storage is unavailable, so the two
   agree in the one case where neither can do better. For everyone else React
   re-renders once with the real value before paint, which is exactly what
   useSyncExternalStore is for; consumers that fetch assets by theme read it at
   effect time, after that correction has landed. */
function getServerSnapshot(): Theme {
    return "dark";
}

export function useTheme(): Theme {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
