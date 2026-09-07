"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFrameSequence } from "../sequence/useFrameSequence";
import SequenceCanvas from "../sequence/SequenceCanvas";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { motion, useMotionValue, animate } from "framer-motion";
import styles from "./KatanaLoader.module.css";

/* ==================================================================
   THE LOADING SCREEN

   A blade drawn out of its saya in the dark, a highlight travelling
   down the steel as the site loads. At full it is drawn, and the cut
   is what uncovers the page.

   MOTIVATION, in one sentence: the site is somewhere you go, so it
   needs a threshold, and the katana's cut is the only hard edit
   anywhere in the journey. Everything after it is one continuous
   camera, which is precisely what makes this one land.

   IT SHOWS ONCE PER SESSION. A loading screen you have to sit through
   every time you press back is a toll gate. sessionStorage, not local:
   coming back tomorrow is a new arrival and deserves the door again;
   clicking through to /experience and back is not.
   ================================================================== */

const FRAMES = 64;
const KEY = "arrived";

function framePath(i: number) {
    return `/scene/katana/frame-${String(i + 1).padStart(3, "0")}.webp`;
}

export default function KatanaLoader() {
    const reduced = useReducedMotion();

    /* Decided during the first render, not from an effect.

       An effect would render null, then flip to the loader, which is a frame
       of the bare page before the door closes over it: the exact flash the
       door exists to prevent. A lazy initialiser is safe here because this
       component is only ever loaded with ssr:false, so it has a real
       sessionStorage the first time it runs. */
    const [show, setShow] = useState(() => {
        if (reduced) return false;
        try {
            return sessionStorage.getItem(KEY) !== "1";
        } catch {
            /* Private browsing, or storage blocked. Show it: one door too
               many is a smaller failure than a blank screen. */
            return true;
        }
    });

    /* Marking it seen is a side effect, so it belongs in one. */
    useEffect(() => {
        if (!show) return;
        try {
            sessionStorage.setItem(KEY, "1");
        } catch {
            /* Nothing to do. The loader still runs and still finishes. */
        }
    }, [show]);

    if (!show) return null;
    return <Blade onDone={() => setShow(false)} />;
}

/* ------------------------------------------------------------------ */

function Blade({ onDone }: { onDone: () => void }) {
    const hostRef = useRef<HTMLDivElement>(null);

    /* The blade's own frames. Theme-neutral: a blade in the dark is the same
       blade whatever the weather outside. */
    const { imagesRef, progress, ready, revision } = useFrameSequence({
        count: FRAMES,
        path: framePath,
    });

    /* What the blade is scrubbed by. Not the raw load fraction: that arrives
       in lurches as batches of images resolve, and a blade that jerks out of
       its sheath reads as a stutter rather than as a draw. This is animated
       toward the real figure, so it always moves smoothly and never runs
       ahead of the truth. */
    const drawn = useMotionValue(0);
    const [cutting, setCutting] = useState(false);

    /* The real measure of "can the site be shown": the hero's first world.
       The blade's own frames are tiny and land almost at once, so scrubbing
       on them would finish while the page behind was still empty. */
    const [siteReady, setSiteReady] = useState(false);
    useEffect(() => {
        let done = false;
        const finish = () => {
            if (!done) {
                done = true;
                setSiteReady(true);
            }
        };
        if (document.readyState === "complete") finish();
        else window.addEventListener("load", finish, { once: true });
        /* A hard ceiling. Something that never fires must not be able to hold
           a visitor behind a door for ever. */
        const bail = window.setTimeout(finish, 6000);
        return () => {
            window.removeEventListener("load", finish);
            window.clearTimeout(bail);
        };
    }, []);

    /* Creep toward whatever is loaded, then run to the end once it is. The
       creep matters: a bar that sits at zero while a large fetch is in flight
       reads as broken, and one that jumps to 90 and waits reads as a lie. */
    useEffect(() => {
        const target = siteReady ? 1 : Math.min(0.92, 0.1 + progress * 0.85);
        const controls = animate(drawn, target, {
            duration: siteReady ? 0.9 : 1.6,
            ease: siteReady ? [0.32, 0, 0.12, 1] : "linear",
        });
        return () => controls.stop();
    }, [siteReady, progress, drawn]);

    /* The cut. Fires once the blade is fully drawn, and the component removes
       itself when the wipe has finished travelling. */
    const cut = useCallback(() => {
        setCutting(true);
        window.setTimeout(onDone, 720);
    }, [onDone]);

    useEffect(() => {
        const stop = drawn.on("change", (v) => {
            if (v >= 0.999) {
                stop();
                cut();
            }
        });
        return stop;
    }, [drawn, cut]);

    /* Nothing behind the door should be reachable while it is shut. */
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    return (
        <motion.div
            ref={hostRef}
            className={styles.host}
            role="status"
            aria-live="polite"
            aria-label="Loading"
            data-cutting={cutting || undefined}
            initial={{ opacity: 1 }}
            animate={{ opacity: cutting ? 0 : 1 }}
            transition={{ duration: 0.45, delay: cutting ? 0.26 : 0, ease: "easeIn" }}
        >
            <SequenceCanvas
                className={styles.blade}
                imagesRef={imagesRef}
                progress={drawn}
                count={FRAMES}
                fit="cover"
                revision={revision}
            />

            {/* The cut itself: a hairline of light that sweeps the diagonal the
                blade is lying on, then the whole door falls away behind it. */}
            <span className={styles.slash} aria-hidden="true" />

            <div className={styles.meter} aria-hidden="true">
                <motion.span className={styles.meterFill} style={{ scaleX: drawn }} />
            </div>

            {/* Only announced once, and only in words. The percentage is on the
                bar for the eye; reading it aloud on every tick is noise. */}
            <span className={styles.sr}>
                {ready ? "Nearly ready" : "Loading"}
            </span>
        </motion.div>
    );
}
