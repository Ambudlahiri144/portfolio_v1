"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "framer-motion";
import styles from "./Journey.module.css";

/* ==================================================================
   THE PIXEL WIPE — Projects to Contact

   The screen turns black one square at a time, the front travelling
   diagonally from the bottom-left corner up to the top-right, until
   nothing of Projects is left. That black is the doorway: Contact opens
   on black and lights up out of it.

   A fixed canvas over everything but the dock, drawn from a scroll
   progress the caller owns (0 = untouched, 1 = fully black), so it scrubs
   and reverses with the scrollbar like every other move on the page.

   THE FRONT IS RAGGED ON PURPOSE. Each cell's threshold is its position
   along the diagonal, shrunk to leave room for a fixed per-cell jitter,
   so cells near the front drop out of order — "one by one" — rather than
   as a clean ruled line sweeping across. The jitter is seeded, so a cell
   always falls at the same moment and scrolling back and forth never
   makes the pattern shimmer.

   `visible` gates the whole element: false before the wipe has begun and
   once Contact has taken the screen, so it is never an invisible
   full-screen layer sitting over the rest of the page.
   ================================================================== */

/* CSS pixels per cell. Small enough to read as pixels at desktop size,
   large enough that a phone is a few hundred cells and not thousands. */
const CELL = 28;
/* How much of the diagonal is given over to jitter. 0 is a hard ruled
   line; 0.14 gives a front about a sixth of the screen wide. */
const JITTER = 0.14;

type Grid = { cols: number; rows: number; order: Uint32Array; thresholds: Float32Array };

function buildGrid(w: number, h: number): Grid {
    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    const n = cols * rows;
    const thresholds = new Float32Array(n);
    /* A small deterministic hash, so the jitter is fixed per cell. */
    let seed = 0x9e3779b9;
    const rand = () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return ((seed >>> 0) % 10000) / 10000;
    };
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            /* 0 at the bottom-left corner, 1 at the top-right. */
            const diag = ((c + 0.5) / cols + (1 - (r + 0.5) / rows)) / 2;
            thresholds[r * cols + c] = diag * (1 - JITTER) + rand() * JITTER;
        }
    }
    /* Cells sorted by when they fall, so painting progress p is "the first
       k cells in this order" — one pass, no per-cell test at draw time. */
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((a, b) => thresholds[a] - thresholds[b]);
    return { cols, rows, order, thresholds };
}

export default function PixelWipe({
    progress,
    visible,
}: {
    progress: MotionValue<number>;
    visible: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !visible) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let grid: Grid | null = null;
        let drawn = -1;
        let raf = 0;

        const resize = () => {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = window.innerWidth;
            const h = window.innerHeight;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            grid = buildGrid(w, h);
            drawn = -1;
        };

        const tick = () => {
            raf = requestAnimationFrame(tick);
            if (!grid) return;
            const p = Math.max(0, Math.min(1, progress.get()));
            /* How many cells have fallen. Past the end the whole screen is
               black, including any remainder a rounding would leave. */
            let k = 0;
            if (p >= 1) k = grid.order.length;
            else {
                const { order, thresholds } = grid;
                let lo = 0;
                let hi = order.length;
                while (lo < hi) {
                    const mid = (lo + hi) >> 1;
                    if (thresholds[order[mid]] <= p) lo = mid + 1;
                    else hi = mid;
                }
                k = lo;
            }
            if (k === drawn) return;
            drawn = k;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (k === 0) return;
            ctx.fillStyle = "#000";
            ctx.beginPath();
            const { cols, order } = grid;
            for (let i = 0; i < k; i++) {
                const cell = order[i];
                const c = cell % cols;
                const r = (cell - c) / cols;
                /* +0.5 overlap so no hairline of the page shows between
                   two black cells at fractional device pixels. */
                ctx.rect(c * CELL, r * CELL, CELL + 0.5, CELL + 0.5);
            }
            ctx.fill();
        };

        resize();
        window.addEventListener("resize", resize);
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, [progress, visible]);

    if (!visible) return null;
    return <canvas ref={canvasRef} className={styles.wipe} aria-hidden="true" />;
}
