"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useBookNav } from "./BookNav";
import { readingPoint, type Hold } from "./timeline";
import styles from "./Book.module.css";

/* ==================================================================
   DOG-EAR — a page corner you can grab.

   Click it and the book turns to the neighbouring spread. Drag it and
   the page turn follows your hand: the drag distance is mapped straight
   onto the scroll range between this spread and the next, so the real
   turn footage plays under the pointer. Nothing is rendered for this;
   the frames are the same ones scrolling plays.

   Let go past 40% and the turn completes; short of it, the page falls
   back. The right page's corner turns forward, the left page's back.
   ================================================================== */

/* How far to drag, in page widths, for a whole turn. A little more than
   the page itself, which is about how far a real corner travels. */
const DRAG_PER_TURN = 1.25;
const COMMIT = 0.4;
/* Below this many pixels of movement it was a click, not a drag. */
const CLICK_SLOP = 6;

export default function DogEar({
    from,
    to,
    side,
    pageWidth,
}: {
    from: Hold;
    to: Hold;
    side: "left" | "right";
    pageWidth: number;
}) {
    const { progress, scrollToProgress } = useBookNav();
    const drag = useRef<{ x: number; moved: boolean; ratio: number } | null>(null);

    const forward = side === "right";
    /* Four points on the way: where the reader is, the edge of this hold,
       the edge of the next, where the next spread reads. The drag spends
       its first stretch clearing this page's words, and the rest on the
       turn itself, so the page lifts as soon as it is pulled. The hold's
       idle remainder, where nothing moves, is skipped. */
    const start = readingPoint(from);
    const leave = forward ? from.to : from.from;
    const arrive = forward ? to.from : to.to;
    const end = readingPoint(to);
    const CLEAR = 0.12;

    const at = (ratio: number) =>
        ratio < CLEAR
            ? start + (leave - start) * (ratio / CLEAR)
            : leave + (arrive - leave) * ((ratio - CLEAR) / (1 - CLEAR));

    const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, moved: false, ratio: 0 };
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        if (!d) return;
        /* Forward turns drag leftward, back turns rightward. */
        const dx = forward ? d.x - e.clientX : e.clientX - d.x;
        if (Math.abs(dx) > CLICK_SLOP) d.moved = true;
        if (!d.moved) return;
        d.ratio = Math.min(1, Math.max(0, dx / (pageWidth * DRAG_PER_TURN)));
        const p = at(d.ratio);
        scrollToProgress(p, { immediate: true });
        /* Skip the spring: the page has to be under the finger, not
           catching up to it. */
        progress.jump(p);
    };

    const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
        const d = drag.current;
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        if (!d) return;
        if (!d.moved) {
            scrollToProgress(end, { duration: 2 });
            return;
        }
        /* Finish the gesture in the time the rest of the turn deserves. */
        const commit = d.ratio >= COMMIT;
        const remaining = commit ? 1 - d.ratio : d.ratio;
        scrollToProgress(commit ? end : start, { duration: 0.35 + remaining * 1.3 });
    };

    return (
        <button
            type="button"
            className={`${styles.dogEar} ${forward ? "" : styles.dogEarLeft}`}
            aria-label={forward ? "Turn the page" : "Turn back a page"}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    scrollToProgress(end, { duration: 2 });
                }
            }}
        >
            <span aria-hidden="true" />
        </button>
    );
}
