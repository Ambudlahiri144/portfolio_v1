"use client";

import { useEffect, useRef } from "react";
import { useBookNav } from "./BookNav";
import { locate } from "./timeline";
import styles from "./Atmosphere.module.css";

/* ==================================================================
   DUST — motes turning in the window light.

   A soft shaft of light falls from the upper left, the direction the
   footage is lit from, and a few dozen motes drift through it. They only
   catch the light inside the shaft, the way dust does, and the cursor
   stirs them: a push away and a little swirl.

   A plain 2D canvas, not WebGL: ninety dots do not need a GPU context of
   their own. It stops when the tab is hidden, dims while a page is
   turning so it never competes with the book, and is not mounted at all
   under reduced motion (BookStatic has no stage).
   ================================================================== */

const COUNT = 90;
/* The shaft's direction, as a CSS gradient angle (0deg is "to top"), and
   where across the gradient it is brightest. Match .beam in the CSS. */
const ANGLE = 118;
const BEAM_AT = 0.4;
const BEAM_HALF = 0.13;

type Mote = { x: number; y: number; vx: number; vy: number; r: number; phase: number };

export default function Dust() {
    const ref = useRef<HTMLCanvasElement>(null);
    const { progress } = useBookNav();

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        let w = 0;
        let h = 0;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const resize = () => {
            w = canvas.clientWidth;
            h = canvas.clientHeight;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        const motes: Mote[] = Array.from({ length: COUNT }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 0,
            vy: 0,
            r: 0.5 + Math.random() * 1.4,
            phase: Math.random() * Math.PI * 2,
        }));

        /* One soft glowing dot, drawn once and stamped. */
        const sprite = document.createElement("canvas");
        sprite.width = sprite.height = 32;
        const sc = sprite.getContext("2d")!;
        const grad = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, "rgba(255, 250, 236, 1)");
        grad.addColorStop(0.35, "rgba(255, 244, 220, 0.5)");
        grad.addColorStop(1, "rgba(255, 244, 220, 0)");
        sc.fillStyle = grad;
        sc.fillRect(0, 0, 32, 32);

        /* Position across the CSS gradient line, 0..1, for a point. */
        const rad = (ANGLE * Math.PI) / 180;
        const dir = { x: Math.sin(rad), y: -Math.cos(rad) };
        const across = (x: number, y: number) => {
            const len = Math.abs(w * dir.x) + Math.abs(h * dir.y);
            const ox = w / 2 - (dir.x * len) / 2;
            const oy = h / 2 - (dir.y * len) / 2;
            return ((x - ox) * dir.x + (y - oy) * dir.y) / len;
        };

        const pointer = { x: -1e4, y: -1e4 };
        const onMove = (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect();
            pointer.x = e.clientX - r.left;
            pointer.y = e.clientY - r.top;
        };
        const onLeave = () => {
            pointer.x = pointer.y = -1e4;
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        document.addEventListener("pointerleave", onLeave);

        let raf = 0;
        let lastP = progress.get();
        let dim = 1;
        let t = 0;

        const tick = () => {
            raf = requestAnimationFrame(tick);
            if (document.hidden || !w) return;
            t += 1 / 60;

            /* Scroll moves the dust a little the other way: parallax. */
            const p = progress.get();
            const scrollShift = (p - lastP) * h * 6;
            lastP = p;

            /* Quieter while the book is moving. */
            const moving = locate(p).seg.kind === "motion";
            dim += ((moving ? 0.45 : 1) - dim) * 0.06;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = "lighter";

            for (const m of motes) {
                /* Brownian drift with a faint updraft. */
                m.vx += (Math.random() - 0.5) * 0.03;
                m.vy += (Math.random() - 0.5) * 0.03 - 0.0015;

                const dx = m.x - pointer.x;
                const dy = m.y - pointer.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < 120 * 120) {
                    const d = Math.sqrt(d2) || 1;
                    const f = (1 - d / 120) * 0.35;
                    /* Pushed away, and swirled round. */
                    m.vx += (dx / d) * f - (dy / d) * f * 0.6;
                    m.vy += (dy / d) * f + (dx / d) * f * 0.6;
                }

                m.vx *= 0.96;
                m.vy *= 0.96;
                m.x += m.vx;
                m.y += m.vy - scrollShift;

                if (m.x < -10) m.x += w + 20;
                if (m.x > w + 10) m.x -= w + 20;
                if (m.y < -10) m.y += h + 20;
                if (m.y > h + 10) m.y -= h + 20;

                /* Lit only inside the shaft. */
                const a = across(m.x, m.y);
                const inBeam = Math.max(0, 1 - Math.abs(a - BEAM_AT) / BEAM_HALF);
                if (inBeam <= 0) continue;
                const twinkle = 0.65 + 0.35 * Math.sin(t * 1.3 + m.phase);
                ctx.globalAlpha = inBeam * inBeam * twinkle * 0.55 * dim;
                const s = m.r * 6;
                ctx.drawImage(sprite, m.x - s / 2, m.y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerleave", onLeave);
        };
    }, [progress]);

    return (
        <>
            <span className={styles.beam} aria-hidden="true" />
            <canvas ref={ref} className={styles.dust} aria-hidden="true" />
        </>
    );
}
