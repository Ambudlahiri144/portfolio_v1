"use client";

import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { useReducedMotion } from "@/lib/useReducedMotion";

/* Tuned to sit close to native. Lenis defaults are heavier than this and start
   to feel like the page is on rails — noticeable on a portfolio where people
   scan rather than read. lerp 0.1 keeps the weight without the lag. */
const OPTIONS = {
    lerp: 0.1,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    /* Touch devices already have momentum scrolling in hardware. Smoothing it
       again fights the platform and feels worse than leaving it alone. */
    smoothWheel: true,
    syncTouch: false,
} as const;

export default function SmoothScroll({
    children,
}: {
    children: React.ReactNode;
}) {
    const reduced = useReducedMotion();

    /* Not initialised at all under reduced motion — no instance, no rAF loop,
       no scroll interception. `root` renders children with no wrapper element,
       so the DOM is identical in both branches. */
    if (reduced) return <>{children}</>;

    return (
        <ReactLenis root options={OPTIONS}>
            {children}
        </ReactLenis>
    );
}
