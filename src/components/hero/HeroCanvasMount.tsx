"use client";

import dynamic from "next/dynamic";
import { useInView } from "@/lib/useinview";
import { useReducedMotion } from "@/lib/useReducedMotion";

/* ssr:false is only legal inside a Client Component — Next throws if it is
   reached from a Server Component. That is the entire reason this wrapper
   exists: Hero.tsx stays a Server Component and renders this. */
const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
    ssr: false,
    /* No skeleton. The hero is designed to read completely without the canvas,
       so a placeholder would only add a flash of something to replace. */
    loading: () => null,
});

export default function HeroCanvasMount() {
    const reduced = useReducedMotion();

    /* once:false because this drives the frame loop, not a one-shot reveal —
       the scene has to suspend again when the hero scrolls away. */
    const { ref, inView } = useInView<HTMLDivElement>({
        once: false,
        threshold: 0,
        rootMargin: "0px",
    });

    /* Nothing is imported at all under reduced motion — the dynamic import
       never runs, so three.js is not fetched, parsed, or executed. This is the
       payload saving, not just a visual opt-out. */
    if (reduced) return null;

    return (
        <div ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <HeroCanvas active={inView} />
        </div>
    );
}
