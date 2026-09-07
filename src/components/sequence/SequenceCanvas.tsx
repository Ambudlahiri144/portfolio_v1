"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { MotionValue } from "framer-motion";
import { cssColor } from "@/lib/color";

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
    fit = "contain",
    className,
    /* True when the frames carry alpha, as the hero's keyed prints do.

       This is the difference between a figure standing ON the gold panel and a
       cream rectangle covering it. An opaque context has to fill with
       something before each frame, and filling with --bg painted the page
       colour over the leaf; a transparent one clears instead, so the panel
       behind shows through everywhere the print is not. */
    transparent = false,
    /* Called with the canvas element once it is mounted, and again with null
       on unmount. The byōbu leaves use it to build a texture from this canvas
       rather than showing it directly: the print becomes the painting on a
       panel, and this element is never seen. */
    onCanvas,
    /* Called after each frame is actually drawn, so a consumer can push the
       new pixels to the GPU. Deliberately not a React state update: this fires
       on every animation frame while scrubbing. */
    onPaint,
    /* Bumping this forces the loop to re-run. Callers pass the preloader's
       `revision` so a newly completed or theme-swapped set gets painted even
       if the scroll position has not moved since mount. */
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
    fit?: Fit;
    className?: string;
    transparent?: boolean;
    onCanvas?: (el: HTMLCanvasElement | null) => void;
    onPaint?: () => void;
    revision?: unknown;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawnRef = useRef(-1);
    /* Held in refs so a caller passing an inline arrow does not tear down and
       rebuild the animation loop on every one of its renders. */
    const onPaintRef = useRef(onPaint);
    useEffect(() => {
        onPaintRef.current = onPaint;
    }, [onPaint]);

    useEffect(() => {
        onCanvas?.(canvasRef.current);
        return () => onCanvas?.(null);
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { alpha: transparent });
        if (!ctx) return;

        let raf = 0;
        let cw = 0;
        let ch = 0;

        /* The letterbox colour, used only when the frames are opaque. It is the
           page's own --bg, read off the document rather than carried as a
           literal, and it only ever paints the strip a contain-fit leaves
           either side on an unusual aspect. */
        const bg = transparent ? "" : cssColor("--bg", "#14100e");

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
               frame — a permanently blank canvas with no error. */
            if (!cw || !ch) return false;

            const img = imagesRef.current[index];
            if (!img || !img.complete || !img.naturalWidth) return false;

            if (transparent) {
                ctx.clearRect(0, 0, cw, ch);
            } else {
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, cw, ch);
            }

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
            if (paint(i)) {
                drawnRef.current = i;
                onPaintRef.current?.();
            }
        };

        /* A new revision means a different image set is now in imagesRef: the
           frame index may be unchanged but the pixels are not. */
        drawnRef.current = -1;

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
    }, [imagesRef, progress, count, seqEnd, fit, transparent, revision]);

    return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
