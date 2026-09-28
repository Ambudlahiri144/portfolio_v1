"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLenis } from "lenis/react";
import { Rope } from "./verlet";
import styles from "./Atmosphere.module.css";

/* ==================================================================
   PULL CORD — something hanging from the top of the page that you can
   pull: the satin bookmark ribbon, the lamp's bead chain.

   Owns the rope, its canvas and the gesture. It sways with the scroll
   (Lenis velocity as wind), gets out of the pointer's way, and its end
   can be grabbed and pulled down; let go past `threshold` and `onPull`
   fires, like a bell pull. Drawing is the caller's (`draw`), so the two
   cords share every line of physics and none of their looks.

   A real button sits over the cord's end for the keyboard.
   ================================================================== */

export type CordDraw = (ctx: CanvasRenderingContext2D, rope: Rope, state: { t: number; pulled: number }) => void;

const WIDTH = 150;

export default function PullCord({
    side,
    length,
    links,
    threshold = 46,
    draw,
    onPull,
    buttonLabel,
    className,
    children,
}: {
    side: "left" | "right";
    /* Resting length in CSS px. */
    length: number;
    links: number;
    threshold?: number;
    draw: CordDraw;
    onPull: () => void;
    buttonLabel: string;
    className?: string;
    children?: ReactNode;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    const lenis = useLenis();
    /* The latest callbacks, without restarting the simulation. */
    const live = useRef({ draw, onPull, lenis });
    useEffect(() => {
        live.current = { draw, onPull, lenis };
    });

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const H = length + 70;
        canvas.width = WIDTH * dpr;
        canvas.height = H * dpr;

        const rope = new Rope(WIDTH / 2, 0, links, length / (links - 1));
        const pointer = { x: -1e4, y: -1e4, inside: false };
        let raf = 0;
        let t = 0;
        let pulled = 0;

        const local = (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        const onDown = (e: PointerEvent) => {
            const p = local(e);
            const tail = rope.pts[rope.pts.length - 1];
            if (Math.hypot(p.x - tail.x, p.y - tail.y) > 30) return;
            e.preventDefault();
            canvas.setPointerCapture(e.pointerId);
            rope.grab = p;
            canvas.style.cursor = "grabbing";
        };
        const onMove = (e: PointerEvent) => {
            const p = local(e);
            pointer.x = p.x;
            pointer.y = p.y;
            if (rope.grab) rope.grab = p;
            else {
                const tail = rope.pts[rope.pts.length - 1];
                canvas.style.cursor = Math.hypot(p.x - tail.x, p.y - tail.y) <= 30 ? "grab" : "";
            }
        };
        const onUp = (e: PointerEvent) => {
            if (!rope.grab) return;
            const stretch = rope.stretch();
            rope.grab = null;
            canvas.style.cursor = "";
            if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
            if (stretch > threshold) {
                pulled = 1;
                live.current.onPull();
            }
        };
        const onLeave = () => {
            pointer.x = pointer.y = -1e4;
        };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onUp);
        canvas.addEventListener("pointerleave", onLeave);

        const tick = () => {
            raf = requestAnimationFrame(tick);
            if (document.hidden) return;
            t += 1 / 60;
            /* Scrolling drags the air: the cord leans against the motion. */
            const v = live.current.lenis?.velocity ?? 0;
            const wind = Math.max(-1.2, Math.min(1.2, -v * 0.02)) * (side === "left" ? -1 : 1) * 0.5;
            rope.step({
                wind,
                push: rope.grab ? undefined : { x: pointer.x, y: pointer.y, r: 26, strength: 2.2 },
            });
            pulled *= 0.92;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, WIDTH, H);
            live.current.draw(ctx, rope, { t, pulled });
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            canvas.removeEventListener("pointerdown", onDown);
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("pointerup", onUp);
            canvas.removeEventListener("pointercancel", onUp);
            canvas.removeEventListener("pointerleave", onLeave);
        };
    }, [length, links, threshold, side]);

    return (
        <div className={`${styles.cord} ${side === "left" ? styles.cordLeft : styles.cordRight} ${className ?? ""}`}>
            <canvas ref={ref} className={styles.cordCanvas} style={{ width: WIDTH, height: length + 70 }} aria-hidden="true" />
            <button
                type="button"
                className={styles.cordButton}
                style={{ top: length - 14 }}
                onClick={() => live.current.onPull()}
            >
                {buttonLabel}
            </button>
            {children}
        </div>
    );
}
