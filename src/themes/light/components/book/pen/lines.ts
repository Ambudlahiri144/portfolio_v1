/* ==================================================================
   LINES — where a block of text's lines are, without touching it.

   The text on a page belongs to React, so it is never split into spans.
   Instead a Range over the block reports one rect per run of text per
   line, and the rects that share a line are merged. The writer masks
   each line separately, and the pen follows its baseline.
   ================================================================== */

export type Line = {
    /* In the block's own box, for its mask. */
    x: number;
    y: number;
    w: number;
    h: number;
    /* In the stage, for the pen: the mask box's left edge (the ink's edge
       is at mx + the line's --wN), and the baseline. */
    mx: number;
    sy: number;
};

export function measureLines(el: HTMLElement, stage: DOMRect): Line[] {
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    range.detach();

    /* Merge the runs of each line: same line if they overlap vertically by
       more than half the shorter one. */
    const lines: { l: number; t: number; r: number; b: number }[] = [];
    for (const r of rects.sort((a, b) => a.top - b.top || a.left - b.left)) {
        const hit = lines.find((q) => Math.min(q.b, r.bottom) - Math.max(q.t, r.top) > Math.min(q.b - q.t, r.height) * 0.5);
        if (hit) {
            hit.l = Math.min(hit.l, r.left);
            hit.r = Math.max(hit.r, r.right);
            hit.t = Math.min(hit.t, r.top);
            hit.b = Math.max(hit.b, r.bottom);
        } else {
            lines.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
        }
    }

    return lines.map((q) => {
        const h = q.b - q.t;
        /* A little room at either end for italic overhang and for the ink's
           soft edge, and top and bottom for accents and descenders. */
        const padX = h * 0.18;
        const padY = h * 0.12;
        return {
            x: q.l - box.left - padX,
            y: q.t - box.top - padY,
            w: q.r - q.l + padX * 2,
            h: h + padY * 2,
            mx: q.l - padX - stage.left,
            /* The baseline sits about four fifths of the way down a line's
               content box. */
            sy: q.t + h * 0.8 - stage.top,
        };
    });
}
