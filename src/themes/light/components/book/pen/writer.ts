import { pen as PEN } from "@light/lib/site";
import { measureLines, type Line } from "./lines";

/* ==================================================================
   WRITER — the order and pace a spread is written in, and the ink.

   A spread's text is marked `data-write` ("line", "heading" or "body",
   which sets the pace). The plan is a list of segments on one clock:

     travel   the pen moving with its nib off the paper: picked up from
              where it lay, back to the start of the next line, on to
              the next block, and at the end down again where it rests
     write    one line, nib on the paper, left to right

   Each block's lines are masked separately (one mask layer per line, its
   edge at --wN), so the text is revealed exactly where the nib has been
   without the DOM ever being split. Finished blocks lose the mask and
   gain data-inked. When the spread has left the page, unwrite() takes
   that off again, so the next time it comes to rest it is written anew.
   ================================================================== */

export type Kind = keyof typeof PEN.speed;
export type Pose = { x: number; y: number; rot: number };

export type Block = { el: HTMLElement; lines: Line[]; kind: Kind };

export type Seg =
    | { kind: "write"; t0: number; t1: number; block: number; line: number }
    | { kind: "travel"; t0: number; t1: number; from: Pose; to: Pose; lift: number };

export type Plan = { blocks: Block[]; segs: Seg[]; end: number };

/* Seconds. A carriage return is quick and low; a move to the next block
   lifts the pen further and takes a little longer. */
const SETTLE = 0.25;
const PICK_UP = 0.4;
const RETURN = 0.09;
const MOVE = 0.16;
const SET_DOWN = 0.5;

/* The ink's soft leading edge, in px. */
export const SOFT = 7;

/* The pen's angle while writing: barrel to the lower right, as held by a
   right-handed writer sitting below the book. */
export const WRITING_ROT = 35;

export function planWriting(spread: HTMLElement, stage: DOMRect, from: Pose, rest: Pose): Plan | null {
    const blocks: Block[] = [...spread.querySelectorAll<HTMLElement>("[data-write]:not([data-inked])")]
        .map((el) => ({
            el,
            kind: (el.dataset.write as Kind) in PEN.speed ? (el.dataset.write as Kind) : "body",
            lines: measureLines(el, stage),
        }))
        .filter((b) => b.lines.length > 0);
    if (blocks.length === 0) return null;

    /* Each line's time from its length in its own em, then all of them
       scaled down together if the spread would take too long. */
    const raw = blocks.map((b) => {
        const em = parseFloat(getComputedStyle(b.el).fontSize) || 16;
        return b.lines.map((l) => l.w / em / PEN.speed[b.kind]);
    });
    const lineCount = raw.reduce((n, r) => n + r.length, 0);
    /* The budget is for the whole spread, moves included, but the writing
       always keeps at least half of it: on a dense page the pen writes
       faster rather than skipping the moves between lines. */
    const travel = SETTLE + PICK_UP + SET_DOWN + RETURN * (lineCount - blocks.length) + MOVE * (blocks.length - 1);
    const writing = raw.flat().reduce((a, b) => a + b, 0);
    const budget = Math.max(PEN.maxSeconds * 0.5, PEN.maxSeconds - travel);
    const k = writing > budget ? budget / writing : 1;

    const segs: Seg[] = [];
    /* A beat for the book to come to rest before the pen is picked up. */
    let t = SETTLE;
    const start = (l: Line): Pose => ({ x: l.mx, y: l.sy, rot: WRITING_ROT });
    const end = (l: Line): Pose => ({ x: l.mx + l.w, y: l.sy, rot: WRITING_ROT });

    let here = from;
    blocks.forEach((b, bi) => {
        b.lines.forEach((l, li) => {
            const first = bi === 0 && li === 0;
            const dur = first ? PICK_UP : li === 0 ? MOVE : RETURN;
            segs.push({ kind: "travel", t0: t, t1: t + dur, from: here, to: start(l), lift: first ? 1 : li === 0 ? 0.7 : 0.35 });
            t += dur;
            const w = raw[bi][li] * k;
            segs.push({ kind: "write", t0: t, t1: t + w, block: bi, line: li });
            t += w;
            here = end(l);
        });
    });
    segs.push({ kind: "travel", t0: t, t1: t + SET_DOWN, from: here, to: rest, lift: 1 });
    t += SET_DOWN;

    blocks.forEach(mask);
    return { blocks, segs, end: t };
}

/* One mask layer per line, each edged at its own --wN. Space between and
   around the lines stays masked, so nothing shows until it is written. */
function mask({ el, lines }: Block) {
    const image = lines
        .map((_, i) => `linear-gradient(to right, #000 calc(var(--w${i}, 0px) - ${SOFT}px), transparent var(--w${i}, 0px))`)
        .join(", ");
    const size = lines.map((l) => `${l.w.toFixed(1)}px ${l.h.toFixed(1)}px`).join(", ");
    const pos = lines.map((l) => `${l.x.toFixed(1)}px ${l.y.toFixed(1)}px`).join(", ");
    for (const pre of ["-webkit-", ""]) {
        el.style.setProperty(`${pre}mask-image`, image);
        el.style.setProperty(`${pre}mask-size`, size);
        el.style.setProperty(`${pre}mask-position`, pos);
        el.style.setProperty(`${pre}mask-repeat`, "no-repeat");
        el.style.setProperty(`${pre}mask-origin`, "border-box");
    }
}

/* How far along line `i` the ink has reached, in px of its mask box. */
export function inkTo(b: Block, i: number, f: number) {
    const l = b.lines[i];
    b.el.style.setProperty(`--w${i}`, `${(f >= 1 ? l.w + SOFT : f * l.w).toFixed(1)}px`);
}

/* A block written: the mask comes off, and the ink dries (data-wet goes,
   and the CSS transition lightens it). */
export function inked(el: HTMLElement) {
    unmask(el);
    el.setAttribute("data-inked", "");
    el.removeAttribute("data-wet");
}

/* The writer's own mask off a block, leaving the stylesheet's (all
   hidden unless data-inked) in charge. */
function unmask(el: HTMLElement) {
    for (const pre of ["-webkit-", ""]) {
        for (const p of ["mask-image", "mask-size", "mask-position", "mask-repeat", "mask-origin"]) {
            el.style.removeProperty(`${pre}${p}`);
        }
    }
    for (let i = 0; el.style.getPropertyValue(`--w${i}`); i++) el.style.removeProperty(`--w${i}`);
}

/* Everything on a spread written at once: the reader asked to see it,
   or the page changed size under the pen. */
export function inkAll(spread: Element) {
    spread.querySelectorAll<HTMLElement>("[data-write]:not([data-inked])").forEach(inked);
}

/* A spread that has gone from the page, made blank again for the pen,
   including a line it was left halfway through. Only ever called once
   it is fully out of view (PenLayer), so no text is seen to vanish. */
export function unwrite(spread: Element) {
    spread.querySelectorAll<HTMLElement>("[data-write]").forEach((el) => {
        unmask(el);
        el.removeAttribute("data-inked");
        el.removeAttribute("data-wet");
    });
}
