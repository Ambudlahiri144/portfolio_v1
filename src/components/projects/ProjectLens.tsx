"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import styles from "./ProjectLens.module.css";

/* Radius of the lens in CSS pixels, and how much it magnifies. 1.16 is enough
   to read as a lens without the seam at the rim becoming obvious — past about
   1.25 the text inside and outside stop lining up convincingly. */
const RADIUS = 74;
const ZOOM = 1.16;

/* How much of the gap the lens closes per frame. A lag is the whole point:
   a cursor that tracks the pointer exactly reads as a cursor, one that trails
   and settles reads as something with mass moving through liquid. */
const EASE = 0.16;

export default function ProjectLens({
    /** A copy of the card's own content, rendered inside the lens. */
    children,
    href,
    label,
}: {
    children: ReactNode;
    href?: string;
    label: string;
}) {
    const reduced = useReducedMotion();

    const hostRef = useRef<HTMLDivElement>(null);
    const lensRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);

    const [hovering, setHovering] = useState(false);

    /* Separate from `hovering` on purpose. The arrow used to travel and fade on
       a loop the whole time the pointer was over a card, which made it read as
       blinking for no reason. It now holds steady, and only launches — flying
       up and out — at the moment the card is actually pressed to open the
       repository, so the motion means something. */
    const [pressed, setPressed] = useState(false);

    /* Pointer state lives in refs. This updates every frame while the pointer
       moves, and routing it through React state would re-render the whole card
       — including the duplicated copy inside the lens — sixty times a second. */
    const target = useRef({ x: 0, y: 0 });
    const pos = useRef({ x: 0, y: 0 });
    const started = useRef(false);

    useEffect(() => {
        if (reduced) return;

        const host = hostRef.current;
        const lens = lensRef.current;
        const inner = innerRef.current;
        if (!host || !lens || !inner) return;

        let raf = 0;

        /* The copy is absolutely positioned inside a 148px circle, so left to
           itself it would lay out at 148px wide and every line would wrap
           differently from the card it is meant to be a magnified view of. It
           has to be pinned to the host's real dimensions. */
        const sizeCopy = () => {
            /* offsetWidth/Height, for the same reason as offsetX/Y below: these
               are the untransformed layout size. getBoundingClientRect reported
               1437x902 for a 1440x900 card mid-animation, and the copy would
               then wrap its text differently from the card it is magnifying. */
            inner.style.width = `${host.offsetWidth}px`;
            inner.style.height = `${host.offsetHeight}px`;
        };

        /* offsetX/offsetY, NOT clientX minus a bounding rect.

           GSAP scales and rotates these cards, and getBoundingClientRect
           returns the *transformed* axis-aligned box — on a card at scale 0.92
           with 4deg of rotation its origin and size are both wrong by a wide
           margin. Deriving local coordinates from it put the lens and its copy
           in a different place from the pointer, which is why the glass showed
           a part of the card nowhere near where it was hovering.

           offsetX/offsetY are relative to the target's own padding box and are
           unaffected by any transform on it or its ancestors. Everything then
           stays in the card's local space — the lens, the copy and the card
           itself all get the same transform applied afterwards, so they agree
           at any point in the stack animation. */
        const localPoint = (e: PointerEvent) => {
            if (e.target === host) return { x: e.offsetX, y: e.offsetY };
            /* Only reachable if something inside the host ever takes pointer
               events; the lens itself is pointer-events:none. */
            const r = host.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };

        const onMove = (e: PointerEvent) => {
            target.current = localPoint(e);
            /* First move after entering: jump rather than glide in from
               wherever the pointer happened to leave last time. */
            if (!started.current) {
                pos.current = { ...target.current };
                started.current = true;
            }
        };

        const onEnter = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            started.current = false;
            onMove(e);
            setHovering(true);
        };

        const onLeave = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            setHovering(false);
            setPressed(false);
        };

        const onDown = () => setPressed(true);

        /* The link opens in a new tab, so this page stays exactly where it is —
           the arrow has to be put back or the next hover would find it already
           gone. The delay lets the launch finish playing first. */
        const onUp = () => {
            window.setTimeout(() => setPressed(false), 520);
        };

        const tick = () => {
            raf = requestAnimationFrame(tick);
            const p = pos.current;
            const t = target.current;
            p.x += (t.x - p.x) * EASE;
            p.y += (t.y - p.y) * EASE;

            /* Written straight to the DOM, never through state. */
            lens.style.transform = `translate3d(${p.x - RADIUS}px, ${p.y - RADIUS}px, 0)`;

            /* The magnifier.

               The copy is scaled about its own origin and then shifted so that
               the card point currently under the pointer lands at the centre of
               the lens. Without this the copy would simply be a zoomed card
               pinned to the corner, and nothing would line up at the rim. */
            inner.style.transform = `translate(${RADIUS - p.x * ZOOM}px, ${RADIUS - p.y * ZOOM}px) scale(${ZOOM})`;
        };

        sizeCopy();
        const ro = new ResizeObserver(sizeCopy);
        ro.observe(host);

        host.addEventListener("pointerenter", onEnter);
        host.addEventListener("pointermove", onMove);
        host.addEventListener("pointerleave", onLeave);
        host.addEventListener("pointerdown", onDown);
        host.addEventListener("pointerup", onUp);
        host.addEventListener("pointercancel", onUp);
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            host.removeEventListener("pointerenter", onEnter);
            host.removeEventListener("pointermove", onMove);
            host.removeEventListener("pointerleave", onLeave);
            host.removeEventListener("pointerdown", onDown);
            host.removeEventListener("pointerup", onUp);
            host.removeEventListener("pointercancel", onUp);
        };
    }, [reduced]);

    /* No lens at all under reduced motion, and no `cursor: none` either — the
       native pointer stays exactly where it is. The card is still a link. */
    if (reduced) {
        return href ? (
            <a href={href} className={styles.plainLink} aria-label={label}>
                <span className={styles.srOnly}>{label}</span>
            </a>
        ) : null;
    }

    const body = (
        <div
            ref={hostRef}
            className={styles.host}
            data-hovering={hovering || undefined}
            data-pressed={pressed || undefined}
        >
            <div ref={lensRef} className={styles.lens} aria-hidden="true">
                {/* The refracting window. overflow:hidden on a circle is what
                    makes the copy read as seen *through* something. */}
                <div className={styles.window}>
                    <div ref={innerRef} className={styles.copy}>
                        {children}
                    </div>
                </div>

                {/* Liquid metal, no bloom. A conic sweep of greys gives the
                    rolled-metal banding; the two inset rings are the lit top
                    edge and the thickness below it. Deliberately no outer
                    glow — that belongs to the dock, not to a cursor. */}
                <span className={styles.rim} />
                <span className={styles.sheen} />

                {/* The wrapper carries the launch so the draw-in on the paths
                    and the exit never fight over the same transform. */}
                <span className={styles.arrowWrap}>
                    <svg
                        className={styles.arrow}
                        viewBox="0 0 64 64"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        {/* Two strokes so the shaft and the head draw one after
                            the other rather than the whole glyph fading up. */}
                        <path className={styles.arrowShaft} pathLength={1} d="M15 49 L49 15" />
                        <path className={styles.arrowHead} pathLength={1} d="M27 15 H49 V37" />
                    </svg>
                </span>
            </div>
        </div>
    );

    return href ? (
        <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.link}
            aria-label={label}
        >
            {body}
        </a>
    ) : (
        body
    );
}
