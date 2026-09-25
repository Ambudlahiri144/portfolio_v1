"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { MotionValue } from "framer-motion";

/* ==================================================================
   FRAME SEQUENCE CANVAS

   Draws one frame of a preloaded sequence per animation frame, picked
   from a scroll-driven motion value. Nothing here goes through React
   state — a scrubbed sequence changes on every rAF, and re-rendering
   the tree at that rate is exactly what makes these feel like a
   flipbook being dragged.
   ================================================================== */

export type Fit = "contain" | "cover";

export default function SequenceCanvas({
    imagesRef,
    progress,
    count,
    seqEnd = 1,
    background,
    fit = "contain",
    className,
    /* Bumping this forces the loop to re-run. Callers pass the preloader's
       `ready` so the first complete frame gets painted even if the scroll
       position has not moved since mount. */
    revision,
}: {
    imagesRef: RefObject<HTMLImageElement[]>;
    progress: MotionValue<number>;
    count: number;
    /**
     * Where the frames run out, 0..1 through the scroll range. Anything past
     * this holds on the last frame — the remaining scroll belongs to whatever
     * the section does after the footage (a slide, a closing beat).
     */
    seqEnd?: number;
    background: string;
    fit?: Fit;
    className?: string;
    revision?: unknown;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawnRef = useRef(-1);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        let raf = 0;
        let cw = 0;
        let ch = 0;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            cw = Math.round(canvas.clientWidth * dpr);
            ch = Math.round(canvas.clientHeight * dpr);
            if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw;
                canvas.height = ch;

                /* Assigning width or height resets the whole 2D context state,
                   so the smoothing hint has to be re-applied every time rather
                   than once at setup. It defaults to "low" — a cheap filter that
                   is very visible on a frame scaled to fill a viewport. */
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                /* The buffer was just reallocated and cleared, so whatever was
                   on screen is gone — force the next tick to repaint. */
                drawnRef.current = -1;
            }
        };

        const paint = (index: number) => {
            /* Bail rather than "successfully" drawing nothing.

               The canvas is sized by CSS from the viewport, so on the first
               effect run it can still measure 0. Painting at 0x0 returns true,
               marks the frame as drawn, and the loop then skips every subsequent
               frame — a permanently black canvas with no error. */
            if (!cw || !ch) return false;

            const img = imagesRef.current[index];
            if (!img || !img.complete || !img.naturalWidth) return false;

            ctx.fillStyle = background;
            ctx.fillRect(0, 0, cw, ch);

            const sx = cw / img.naturalWidth;
            const sy = ch / img.naturalHeight;
            const scale = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
            return true;
        };

        const tick = () => {
            raf = requestAnimationFrame(tick);
            const t = Math.min(1, progress.get() / seqEnd);
            /* Clamped: at t exactly 1 the raw index lands one past the end and
               the last frame flickers to nothing. */
            const i = Math.min(count - 1, Math.max(0, Math.floor(t * count)));
            if (i === drawnRef.current) return;
            if (paint(i)) drawnRef.current = i;
        };

        resize();
        raf = requestAnimationFrame(tick);

        /* Observing the canvas rather than the window. Its height comes from a
           CSS calc on the viewport width, so it can settle after the effect has
           already run — and a window resize listener alone never hears about
           that first 0 -> real transition. */
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [imagesRef, progress, count, seqEnd, background, fit, revision]);

    return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
