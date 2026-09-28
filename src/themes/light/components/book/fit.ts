/* ==================================================================
   FIT — how a footage frame maps onto the stage.

   One function, used by the canvas to draw and by the page overlay to
   position HTML, so the text lands on the paper by construction rather
   than by two sets of maths that happen to agree.

   The rule: fill the stage like `object-fit: cover`, but never scale so
   far that the book itself is cropped. On a very wide or very tall
   stage that means the frame stops short of an edge; the canvas fills
   the rest with the tablecloth colour and feathers the seam.
   ================================================================== */

import type { Rect } from "./timeline";

export type Fit = {
    scale: number;
    /** Where the frame's top-left lands on the stage, in CSS px. */
    x: number;
    y: number;
    /** The frame's drawn size, in CSS px. */
    w: number;
    h: number;
};

export function computeFit(
    stageW: number,
    stageH: number,
    srcW: number,
    srcH: number,
    keep: Rect,
    /* Space kept clear at the stage's bottom for the dock, in CSS px. */
    reserveBottom = 0,
): Fit {
    const cover = Math.max(stageW / srcW, stageH / srcH);
    const [, , kw, kh] = keep;
    /* 4% breathing room on the sides, and the dock's band at the bottom. */
    const maxForKeep = Math.min(
        (stageW * 0.96) / kw,
        (stageH - reserveBottom) / kh,
    );
    const scale = Math.max(0.01, Math.min(cover, maxForKeep));
    const w = srcW * scale;
    const h = srcH * scale;

    /* Centre the keep-rect, not the frame: the book is not quite centred in
       the footage, and it is the book the eye measures against the stage. */
    const [kx, ky] = keep;
    let x = stageW / 2 - (kx + kw / 2) * scale;
    let y = (stageH - reserveBottom) / 2 - (ky + kh / 2) * scale;

    /* ...but never pull the frame's edge inside the stage when the frame is
       big enough to cover it. A bare strip of flat colour beside real linen
       reads as a mistake. */
    if (w >= stageW) x = Math.min(0, Math.max(stageW - w, x));
    else x = (stageW - w) / 2;
    if (h >= stageH) y = Math.min(0, Math.max(stageH - h, y));

    return { scale, x, y, w, h };
}

/* A rectangle in source pixels, placed on the stage in CSS px. */
export function place(fit: Fit, [rx, ry, rw, rh]: Rect) {
    return {
        left: fit.x + rx * fit.scale,
        top: fit.y + ry * fit.scale,
        width: rw * fit.scale,
        height: rh * fit.scale,
    };
}
