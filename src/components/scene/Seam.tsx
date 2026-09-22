"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import styles from "./scene.module.css";

/* ==================================================================
   SEAM

   Sits between two sections and makes the join between them one
   continuous camera move rather than two shots butted together.

   MOTIVATION, in one sentence: the whole site is a journey, and a
   journey does not cut between places, it travels between them.

   The mechanism is deliberately modest. It is a band of the same air
   both worlds are full of, thickest exactly where the boundary is, and
   it is driven by the scroll so the haze gathers as you approach the
   join and clears once you are through. The sections either side keep
   doing their own camera moves; this only stops the moment they meet
   from being a visible edit.

   Not a WebGL crossfade of two rendered scenes, which is what this
   looked like on paper. That needs both neighbours drawn into textures
   at once, which is two extra full-viewport surfaces per seam, live,
   on a page that already scrubs a frame sequence. The cost is real and
   the difference, at the speed a scroll passes through 46vh of screen,
   is not visible.
   ================================================================== */

/* Split into two components, the same way ContactSequence and Footer are and
   for the same reason they document: hooks cannot be called conditionally, so
   a single component has to run useScroll on the reduced-motion path too —
   where its target ref is never attached and Motion throws "Target ref is
   defined but not hydrated" into the console. Three seams on the page meant
   three of those. */
export default function Seam({
    /**
     * The colour the haze is made of. Defaults to the page's own --bg,
     * which is right between two ordinary sections and wrong next to a
     * fixed-palette world — see the note on .seamAir.
     */
    tint,
}: { tint?: string } = {}) {
    /* Under reduced motion the seam still exists, because the two sections
       still need something between them, but it holds still. */
    return useReducedMotion() ? (
        <div
            className={styles.seam}
            style={tint ? ({ "--seam-tint": tint } as React.CSSProperties) : undefined}
            aria-hidden="true"
        >
            <span className={styles.seamAir} />
        </div>
    ) : (
        <MovingSeam tint={tint} />
    );
}

function MovingSeam({ tint }: { tint?: string }) {
    const ref = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });
    /* The same spring the sections use, so the haze arrives on the same
       curve their cameras do rather than tracking the raw scrollbar. */
    const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 28 });

    const opacity = useTransform(smooth, [0, 0.5, 1], [0, 1, 0]);
    /* A small push through the band. Enough to feel like travel, small
       enough never to read as a zoom. */
    const z = useTransform(smooth, [0, 1], [-120, 120]);

    return (
        <div
            ref={ref}
            className={styles.seam}
            style={tint ? ({ "--seam-tint": tint } as React.CSSProperties) : undefined}
            aria-hidden="true"
        >
            <motion.span className={styles.seamAir} style={{ opacity, z }} />
        </div>
    );
}
