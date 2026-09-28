/* ==================================================================
   POP-UP CHOREOGRAPHY — what the scroll does inside the pop-up hold.

   `local` is 0..1 through the hold:
     0.00-0.14  the cards rise off the page, one after another
     0.14-0.86  a spotlight moves through the projects in turn
     0.86-1.00  everything folds back flat before the camera leaves

   Pure functions, shared by the DOM layer (which project to caption)
   and the 3D scene (how far each hinge is open).
   ================================================================== */

import { projects } from "@light/lib/site";

const N = projects.length;
export const RISE_END = 0.14;
export const FOLD_START = 0.86;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/* Paper settling: quick off the page, slow into place. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/* How open card i's hinge is: 0 flat on the page, 1 standing. Staggered
   so the spread opens back row first, the way a pop-up's layers do. */
export function hingeAt(local: number, i: number) {
    const rise = clamp01((local - 0.015 - i * 0.022) / 0.07);
    const fold = clamp01((0.985 - local - (N - 1 - i) * 0.018) / 0.06);
    return easeOut(Math.min(rise, fold));
}

/* Which project the scroll has in the spotlight, or -1 while the cards
   are still rising or already folding. */
export function spotAt(local: number) {
    if (local < RISE_END || local >= FOLD_START) return -1;
    const t = (local - RISE_END) / (FOLD_START - RISE_END);
    return Math.min(N - 1, Math.floor(t * N));
}
