/* ==================================================================
   BOOK TIMELINE — scroll progress in, frame and spread out.

   Pure functions over bookTimeline in lib/site.ts. The canvas asks
   "which frame?" on every animation frame, and the page overlay asks
   "which spread, and how far into it?" — both read the same answer, so
   text can never sit on a page the canvas is not showing.
   ================================================================== */

import { bookTimeline, type BookClip, type BookSegment, type SpreadId } from "@light/lib/site";
import manifest from "../../../../../public/book/manifest.json";

export type Manifest = typeof manifest;
export { manifest };

export type Rect = readonly [number, number, number, number];

/* The manifest is JSON, so its rectangles type as number[]. */
export const rect = (r: readonly number[]): Rect => [r[0], r[1], r[2], r[3]];

export type PlacedSegment = BookSegment & {
    /** 0..1 through the whole book. */
    from: number;
    to: number;
};

export type Hold = Extract<PlacedSegment, { kind: "hold" }> & {
    /** The frame this hold rests on. */
    clip: BookClip;
    frame: number;
};

export const totalVh = bookTimeline.reduce((sum, s) => sum + s.vh, 0);

export const segments: PlacedSegment[] = (() => {
    let at = 0;
    return bookTimeline.map((s) => {
        const from = at / totalVh;
        at += s.vh;
        return { ...s, from, to: at / totalVh };
    });
})();

const clipCount = (clip: BookClip) => manifest.clips[clip].count;

/* Where a motion ends. A reversed clip ends on its first frame. */
function endOf(seg: Extract<BookSegment, { kind: "motion" }>) {
    return { clip: seg.clip, frame: seg.reverse ? 0 : clipCount(seg.clip) - 1 };
}

function startOf(seg: Extract<BookSegment, { kind: "motion" }>) {
    return { clip: seg.clip, frame: seg.reverse ? clipCount(seg.clip) - 1 : 0 };
}

/* A hold shows whatever the motion before it ended on — or, for the very
   first hold, whatever the motion after it starts on. Derived, not written
   down, so reordering the timeline can never leave a hold on a frame the
   book is not actually at. */
export const holds: Hold[] = segments.flatMap((seg, i) => {
    if (seg.kind !== "hold") return [];
    const prev = segments.slice(0, i).reverse().find((s) => s.kind === "motion");
    const next = segments.slice(i + 1).find((s) => s.kind === "motion");
    const at = prev && prev.kind === "motion"
        ? endOf(prev)
        : next && next.kind === "motion"
            ? startOf(next)
            : { clip: "open" as BookClip, frame: 0 };
    return [{ ...seg, ...at }];
});

/* The segment containing progress p, and how far through it p is. */
export function locate(p: number) {
    const clamped = Math.min(1, Math.max(0, p));
    const i = segments.findIndex((s) => clamped <= s.to);
    const index = i === -1 ? segments.length - 1 : i;
    const seg = segments[index];
    const span = seg.to - seg.from || 1;
    return { index, seg, t: Math.min(1, Math.max(0, (clamped - seg.from) / span)) };
}

export type FrameRef = { clip: BookClip; frame: number };

export function frameAt(p: number): FrameRef {
    const { seg, t } = locate(p);
    if (seg.kind === "hold") {
        const hold = holds.find((h) => h.from === seg.from)!;
        return { clip: hold.clip, frame: hold.frame };
    }
    const n = clipCount(seg.clip);
    /* Round, not floor: at t = 1 floor would stop one frame short of the
       frame the next hold shows, and the hand-off would visibly step. */
    const f = Math.round(t * (n - 1));
    return { clip: seg.clip, frame: seg.reverse ? n - 1 - f : f };
}

/* Where a hold's content is fully on the page, 0..1 — the anchor point.
   Just past the fade-in, so a jump lands on readable text. */
export function readingPoint(hold: Pick<PlacedSegment, "from" | "to">) {
    return hold.from + (hold.to - hold.from) * FADE;
}

/* How much of each end of a hold its content spends fading, as a
   fraction of the hold. */
export const FADE = 0.14;

export function spreadRange(spread: SpreadId) {
    const h = holds.find((x) => x.spread === spread)!;
    return { from: h.from, to: h.to, first: h.from === 0, last: h.to === 1 };
}
