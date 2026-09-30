"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type RefObject } from "react";
import { stationery } from "@light/lib/site";
import { useReducedMotion } from "@light/lib/useReducedMotion";
import styles from "./Stationery.module.css";

/* ==================================================================
   STAMPS — the postage stamp that sends, the postmark that cancels it,
   and the rubber stamps the engagement card gets.

   The postage stamp carries the portrait from About, perforated. It
   waits beside the paper; dragged onto the paper's stamp box it snaps
   in and the paper is sent. The Send button beside it does the same
   (and is what keyboards and screen readers use), so the drag is a
   pleasure, never the only way.
   ================================================================== */

const { stamp: copy } = stationery;

export function StampFace() {
    return (
        <span className={styles.stampFace}>
            <span className={styles.stampLegend}>{copy.legend}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.stampArt} src="/book/props/portrait.webp" alt="" draggable={false} />
            <span className={styles.stampValue}>{copy.value}</span>
        </span>
    );
}

export type HandStampHandle = { rect: () => DOMRect | null };

/* The stamp in hand: dragged by pointer, anywhere; dropped over the target
   it asks to be stuck (onDrop decides), otherwise it springs back. */
export const HandStamp = forwardRef<
    HandStampHandle,
    {
        target: RefObject<HTMLElement | null>;
        onDrop: (from: DOMRect) => boolean;
        hidden: boolean;
    }
>(function HandStamp({ target, onDrop, hidden }, ref) {
    const el = useRef<HTMLSpanElement>(null);
    const drag = useRef<{ id: number; x: number; y: number; over: boolean } | null>(null);

    useImperativeHandle(ref, () => ({ rect: () => el.current?.getBoundingClientRect() ?? null }), []);

    const isOver = (s: DOMRect) => {
        const t = target.current?.getBoundingClientRect();
        if (!t) return false;
        const cx = s.left + s.width / 2;
        const cy = s.top + s.height / 2;
        /* Generous: near enough is on it, the way a stamp is slapped on. */
        const pad = s.width * 0.6;
        return cx > t.left - pad && cx < t.right + pad && cy > t.top - pad && cy < t.bottom + pad;
    };

    const markOver = (over: boolean) => {
        const t = target.current;
        if (t) t.toggleAttribute("data-over", over);
        el.current?.toggleAttribute("data-over", over);
    };

    return (
        <span
            ref={el}
            className={styles.handStamp}
            data-hidden={hidden || undefined}
            aria-hidden="true"
            onPointerDown={(e) => {
                if (hidden || e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, over: false };
                e.currentTarget.getAnimations().forEach((a) => a.cancel());
                e.currentTarget.setAttribute("data-dragging", "");
            }}
            onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.id !== e.pointerId) return;
                const s = e.currentTarget;
                s.style.translate = `${e.clientX - d.x}px ${e.clientY - d.y}px`;
                const over = isOver(s.getBoundingClientRect());
                if (over !== d.over) {
                    d.over = over;
                    markOver(over);
                }
            }}
            onPointerUp={(e) => {
                const d = drag.current;
                if (!d || d.id !== e.pointerId) return;
                drag.current = null;
                const s = e.currentTarget;
                s.removeAttribute("data-dragging");
                markOver(false);
                const at = s.getBoundingClientRect();
                const moved = s.style.translate;
                s.style.translate = "";
                if (d.over && onDrop(at)) return;
                /* Not on the box, or the paper is not ready: back to hand. */
                if (moved) {
                    s.animate([{ translate: moved }, { translate: "0px 0px" }], {
                        duration: 480,
                        easing: "cubic-bezier(0.3, 1.5, 0.5, 1)",
                    });
                }
            }}
            onPointerCancel={(e) => {
                drag.current = null;
                e.currentTarget.style.translate = "";
                e.currentTarget.removeAttribute("data-dragging");
                markOver(false);
            }}
        >
            <StampFace />
        </span>
    );
});

/* The stamp on the paper. It arrives from wherever it was let go (or from
   the hand, when Send was pressed) and lands with a squash. */
export function StuckStamp({ from, trembling }: { from: RefObject<DOMRect | null>; trembling: boolean }) {
    const el = useRef<HTMLSpanElement>(null);
    const reduced = useReducedMotion();

    useLayoutEffect(() => {
        const node = el.current;
        const start = from.current;
        if (!node || !start || reduced) return;
        const end = node.getBoundingClientRect();
        const dx = start.left - end.left;
        const dy = start.top - end.top;
        const s = start.width / end.width;
        node.animate(
            [
                { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-7deg)` },
                { transform: "translate(0, -0.25em) scale(1.08) rotate(-2deg)", offset: 0.7 },
                { transform: "scale(1.04, 0.93)", offset: 0.86 },
                { transform: "none" },
            ],
            { duration: 520, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)" },
        );
    }, [from, reduced]);

    return (
        <span ref={el} className={styles.stuckStamp} data-trembling={trembling || undefined} aria-hidden="true">
            <StampFace />
        </span>
    );
}

/* The cancellation: a dated ring and wavy lines, inked over the stamp. */
export function Postmark({ date }: { date: string }) {
    return (
        <svg className={styles.postmark} viewBox="0 0 120 60" aria-hidden="true">
            {/* The ring lands on the stamp (the box is at the paper's top
                right); the wavy lines run back across the paper. */}
            <circle cx="92" cy="30" r="22" pathLength={1} />
            <circle cx="92" cy="30" r="16.5" pathLength={1} />
            <text x="92" y="27.5" textAnchor="middle" className={styles.postmarkTop}>
                {copy.legend.toUpperCase()}
            </text>
            <text x="92" y="36.5" textAnchor="middle" className={styles.postmarkDate}>
                {date}
            </text>
            {[22, 30, 38].map((y) => (
                <path key={y} pathLength={1} d={`M4 ${y} q7 -4.5 14 0 t14 0 t14 0 t14 0`} />
            ))}
        </svg>
    );
}

export function RubberStamp({ text, tone = "red", className }: { text: string; tone?: "red" | "green"; className?: string }) {
    return (
        <span className={`${styles.rubber} ${className ?? ""}`} data-tone={tone} aria-hidden="true">
            {text}
        </span>
    );
}

/* "29 SEP 2026", in the reader's own time. */
export function postmarkDate(d = new Date()) {
    return d
        .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        .toUpperCase();
}
