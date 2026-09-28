"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { MotionValue } from "framer-motion";
import type { Fit } from "./fit";
import { frameAt, manifest } from "./timeline";
import type { FrameStore } from "./useBookFrames";

/* ==================================================================
   BOOK CANVAS

   Draws the frame the timeline says belongs to the current scroll
   position. Same discipline as the dark theme's SequenceCanvas: its own
   rAF loop, nothing through React state, and a redraw only when the
   frame (or the size, or the set of loaded frames) actually changes.

   Placement comes from the parent's Fit, which the page overlay uses as
   well — the paper under the text and the text are positioned by one
   calculation.
   ================================================================== */

/* How far the frame's edge is blended into the tablecloth colour when the
   frame stops short of the stage, in CSS px. */
const FEATHER = 90;

export default function BookCanvas({
    store,
    progress,
    fit,
    stage,
    className,
}: {
    store: RefObject<FrameStore | null>;
    progress: MotionValue<number>;
    fit: Fit | null;
    stage: { w: number; h: number };
    className?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !fit || !stage.w || !stage.h) return;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(stage.w * dpr);
        canvas.height = Math.round(stage.h * dpr);
        /* Resetting width/height resets the context, smoothing included. */
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        const bg = manifest.table;
        let drawn = "";
        let drewSource: ImageBitmap | null = null;
        let raf = 0;

        const feather = (x0: number, y0: number, x1: number, y1: number) => {
            const g = ctx.createLinearGradient(x0, y0, x1, y1);
            g.addColorStop(0, bg);
            g.addColorStop(1, `${bg}00`);
            return g;
        };

        const paint = (src: ImageBitmap) => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, stage.w, stage.h);
            ctx.drawImage(src, fit.x, fit.y, fit.w, fit.h);

            /* Only where the frame is inset — against a covering frame there
               is no seam to hide. */
            const f = FEATHER;
            if (fit.x > 0.5) {
                ctx.fillStyle = feather(fit.x, 0, fit.x + f, 0);
                ctx.fillRect(fit.x, 0, f, stage.h);
                ctx.fillStyle = feather(fit.x + fit.w, 0, fit.x + fit.w - f, 0);
                ctx.fillRect(fit.x + fit.w - f, 0, f, stage.h);
            }
            if (fit.y > 0.5) {
                ctx.fillStyle = feather(0, fit.y, 0, fit.y + f);
                ctx.fillRect(0, fit.y, stage.w, f);
            }
            if (fit.y + fit.h < stage.h - 0.5) {
                ctx.fillStyle = feather(0, fit.y + fit.h, 0, fit.y + fit.h - f);
                ctx.fillRect(0, fit.y + fit.h - f, stage.w, f);
            }
        };

        const tick = () => {
            raf = requestAnimationFrame(tick);
            const s = store.current;
            if (!s) return;
            const ref = frameAt(progress.get());
            s.focus(ref);
            const src = s.drawable(ref);
            if (!src) return;
            /* Keyed on the source as well as the frame: while the exact frame
               decodes a neighbour stands in, and the moment the real one
               lands it deserves a repaint even though the frame is the same. */
            const k = `${ref.clip}:${ref.frame}`;
            if (k === drawn && src === drewSource) return;
            paint(src);
            drawn = k;
            drewSource = src;
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [store, progress, fit, stage.w, stage.h]);

    return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
