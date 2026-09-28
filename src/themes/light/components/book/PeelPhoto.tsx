"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useReducedMotion } from "@light/lib/useReducedMotion";
import { useSpreadActive } from "./SpreadActive";
import styles from "./PeelPhoto.module.css";

/* ==================================================================
   PEEL PHOTO — a print on the page you can lift by its corner.

   Drag the lower-right corner and the print folds back along a line,
   showing its paper back and, underneath, a note written on the page.
   Let go and it settles back. A button does the same for the keyboard:
   it opens the fold fully, and again closes it.

   The fold is exact rather than faked. For corner C and pointer P, the
   crease is the perpendicular bisector of CP. The part of the print on
   C's side of it is clipped out of the photograph and drawn again,
   reflected across the crease, as the back of the print: the same thing
   that happens to a real sheet folded so its corner lands on your
   finger.
   ================================================================== */

type Pt = { x: number; y: number };

/* Sutherland–Hodgman: the part of a convex polygon where (p - m)·n >= 0. */
function clipHalf(poly: Pt[], m: Pt, n: Pt): Pt[] {
    const side = (p: Pt) => (p.x - m.x) * n.x + (p.y - m.y) * n.y;
    const out: Pt[] = [];
    poly.forEach((a, i) => {
        const b = poly[(i + 1) % poly.length];
        const sa = side(a);
        const sb = side(b);
        if (sa >= 0) out.push(a);
        if (sa >= 0 !== sb >= 0) {
            const t = sa / (sa - sb);
            out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
    });
    return out;
}

const poly = (pts: Pt[]) =>
    pts.length ? `polygon(${pts.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(",")})` : "polygon(0 0)";

/* ------------------------------------------------------------------
   Drawing in. The first time the page it is on comes to rest, the
   portrait is drawn rather than simply shown: its contour lines sweep
   in, then the graphite shading is laid in over them in patches, the
   way shading goes down with a pencil. Once per visit; reduced motion
   and the unbound layout show the finished drawing.
   ------------------------------------------------------------------ */

const DRAW_MS = 1700;
let drawnThisVisit = false;

function useDrawIn() {
    const active = useSpreadActive();
    const reduced = useReducedMotion();
    const [p, setP] = useState(() => (active === null || drawnThisVisit ? 1 : 0));

    useEffect(() => {
        if (!active || drawnThisVisit || reduced) return;
        drawnThisVisit = true;
        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / DRAW_MS);
            setP(t);
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [active, reduced]);

    /* Reduced motion never animates; show it done. */
    return reduced ? 1 : p;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function PeelPhoto({
    src,
    linesSrc,
    alt,
    note,
}: {
    src: string;
    /* The drawing's contour lines alone, drawn first. */
    linesSrc?: string;
    alt: string;
    note: string;
}) {
    const reduced = useReducedMotion();
    const draw = useDrawIn();
    const filterId = `graphite-${useId().replace(/:/g, "")}`;
    const box = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    /* Where the corner is, in the print's own pixels; null at rest. The
       animation owns the ref and publishes it to state once per frame. */
    const [corner, setCorner] = useState<Pt | null>(null);
    const cornerRef = useRef<Pt | null>(null);
    const sizeRef = useRef({ w: 0, h: 0 });
    const target = useRef<Pt | null>(null);
    const dragging = useRef(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => {
            sizeRef.current = { w: e.contentRect.width, h: e.contentRect.height };
            setSize(sizeRef.current);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const rest = (): Pt => ({ x: sizeRef.current.w, y: sizeRef.current.h });
    /* Fully open: the corner folded up past the middle, so the lower right
       of the page, where the note is, is uncovered. */
    const opened = (): Pt => ({ x: sizeRef.current.w * 0.22, y: sizeRef.current.h * 0.18 });

    /* Ease the corner toward its target. While dragging the target is the
       pointer, so the ease is quick; released, it settles. */
    useEffect(() => {
        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            const t = target.current;
            if (!t) return;
            const { w, h } = sizeRef.current;
            const from = cornerRef.current ?? { x: w, y: h };
            const k = dragging.current ? 0.5 : reduced ? 1 : 0.16;
            let next = { x: from.x + (t.x - from.x) * k, y: from.y + (t.y - from.y) * k };
            if (Math.hypot(next.x - t.x, next.y - t.y) < 0.4) {
                next = t;
                if (!dragging.current) target.current = null;
            }
            cornerRef.current = next.x === w && next.y === h ? null : next;
            setCorner(cornerRef.current);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [reduced]);

    const local = (e: ReactPointerEvent) => {
        const r = box.current!.getBoundingClientRect();
        const { w, h } = sizeRef.current;
        return {
            x: Math.min(w, Math.max(-w * 0.1, e.clientX - r.left)),
            y: Math.min(h, Math.max(-h * 0.1, e.clientY - r.top)),
        };
    };

    const onDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        target.current = local(e);
    };
    const onMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
        if (dragging.current) target.current = local(e);
    };
    const onUp = () => {
        if (!dragging.current) return;
        dragging.current = false;
        /* Let go and the print settles, open or shut, whichever it is nearer. */
        const c = cornerRef.current ?? rest();
        const { w, h } = sizeRef.current;
        const openEnough = Math.hypot(w - c.x, h - c.y) > Math.hypot(w, h) * 0.3;
        setOpen(openEnough);
        target.current = openEnough ? opened() : rest();
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);
        target.current = next ? opened() : rest();
    };

    /* ---- the fold ---------------------------------------------------- */
    const { w, h } = size;
    const C = { x: w, y: h };
    const P = corner;
    let photoClip: string | undefined;
    let flapClip = "polygon(0 0)";
    let flapTransform: string | undefined;
    let shadeAngle = 0;

    if (P && w && Math.hypot(C.x - P.x, C.y - P.y) > 0.5) {
        const m = { x: (C.x + P.x) / 2, y: (C.y + P.y) / 2 };
        const len = Math.hypot(C.x - P.x, C.y - P.y);
        const n = { x: (C.x - P.x) / len, y: (C.y - P.y) / len };
        const rect = [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h },
        ];
        photoClip = poly(clipHalf(rect, m, { x: -n.x, y: -n.y }));
        flapClip = poly(clipHalf(rect, m, n));
        /* Reflection across the crease (through m, normal n):
           v' = v - 2((v - m)·n) n  =>  a 2D affine matrix. */
        const a = 1 - 2 * n.x * n.x;
        const b = -2 * n.x * n.y;
        const d = 1 - 2 * n.y * n.y;
        const k = 2 * (m.x * n.x + m.y * n.y);
        flapTransform = `matrix(${a}, ${b}, ${b}, ${d}, ${k * n.x}, ${k * n.y})`;
        /* Light falls across the fold: brightest at the crease. */
        shadeAngle = (Math.atan2(n.x, -n.y) * 180) / Math.PI;
    }

    return (
        <figure className={styles.wrap}>
            <p className={styles.note}>{note}</p>
            <div ref={box} className={styles.print}>
                <DrawnFace
                    src={src}
                    linesSrc={linesSrc}
                    alt={alt}
                    draw={draw}
                    filterId={filterId}
                    clip={photoClip}
                />
                <span className={styles.flapShadow} aria-hidden="true">
                    <span
                        className={styles.flap}
                        style={{
                            clipPath: flapClip,
                            transform: flapTransform,
                            background: `linear-gradient(${shadeAngle + 180}deg, #f7f1e6 0%, #e2d7c5 70%)`,
                        }}
                    />
                </span>
                <span
                    className={styles.grip}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    aria-hidden="true"
                />
            </div>
            <button type="button" className={styles.toggle} onClick={toggle} aria-expanded={open}>
                {open ? "Put the photo back" : "Peel back the photo"}
            </button>
        </figure>
    );
}

/* The print's face: the card, then the contour lines, then the shaded
   drawing. The peel's clip applies to all three at once. */
function DrawnFace({
    src,
    linesSrc,
    alt,
    draw,
    filterId,
    clip,
}: {
    src: string;
    linesSrc?: string;
    alt: string;
    draw: number;
    filterId: string;
    clip?: string;
}) {
    /* Lines sweep in over the first half; shading from 30% to the end. */
    const lines = clamp01(draw / 0.5);
    const shade = clamp01((draw - 0.3) / 0.7);
    const drawing = draw < 1;
    /* The shading's threshold: noise brighter than T shows. From above
       the noise's range (nothing) to below it (everything). */
    const T = 0.9 - shade * 0.95;
    const linesOpacity = drawing ? clamp01((1 - draw) / 0.25) : 0;
    const wipe = `linear-gradient(168deg, #000 ${lines * 130 - 25}%, transparent ${lines * 130}%)`;

    return (
        <div className={styles.face} style={{ clipPath: clip }}>
            <span className={styles.card} aria-hidden="true" />
            {linesSrc && drawing && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={linesSrc}
                    alt=""
                    aria-hidden="true"
                    className={styles.art}
                    style={{ opacity: linesOpacity, maskImage: wipe, WebkitMaskImage: wipe }}
                    draggable={false}
                />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                className={`${styles.art} ${styles.shaded}`}
                style={drawing ? { filter: `url(#${filterId}) sepia(0.22) contrast(0.96)` } : undefined}
                draggable={false}
            />
            {drawing && (
                <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
                    <filter id={filterId} x="0" y="0" width="1" height="1">
                        <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="4" result="noise" />
                        <feColorMatrix in="noise" type="luminanceToAlpha" result="lum" />
                        <feComponentTransfer in="lum" result="mask">
                            <feFuncA type="linear" slope="6" intercept={-6 * T} />
                        </feComponentTransfer>
                        <feComposite in="SourceGraphic" in2="mask" operator="in" />
                    </filter>
                </svg>
            )}
        </div>
    );
}
