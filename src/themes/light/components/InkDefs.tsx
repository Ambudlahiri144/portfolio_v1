"use client";

import { useEffect } from "react";

/* ==================================================================
   INK DEFS — what the ink-bloom buttons need, once per page.

   Any element with the `ink` class (theme.css) fills with ink on hover,
   spreading from the point the pointer came in and wicking out ragged
   at the edge the way ink does into paper. This provides the two shared
   pieces:

   - #ink-edge, the SVG filter that roughens the bloom's edge: fractal
     noise displacing the circle's outline by a few pixels.
   - one delegated listener that records where the pointer entered each
     `.ink` element (--ix/--iy), so the bloom starts there rather than
     at the centre.
   ================================================================== */

export default function InkDefs() {
    useEffect(() => {
        const onOver = (e: PointerEvent) => {
            const el = (e.target as Element | null)?.closest?.<HTMLElement>(".ink");
            if (!el) return;
            /* Only on entering the element, not on moving between its
               children. */
            const from = e.relatedTarget as Node | null;
            if (from && el.contains(from)) return;
            const r = el.getBoundingClientRect();
            el.style.setProperty("--ix", `${e.clientX - r.left}px`);
            el.style.setProperty("--iy", `${e.clientY - r.top}px`);
        };
        document.addEventListener("pointerover", onOver, { passive: true });
        return () => document.removeEventListener("pointerover", onOver);
    }, []);

    return (
        <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }} focusable="false">
            <filter id="ink-edge" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="7" />
                <feDisplacementMap in="SourceGraphic" scale="11" xChannelSelector="R" yChannelSelector="G" />
            </filter>
        </svg>
    );
}
