"use client";

import { useState } from "react";
import { useMotionValueEvent } from "framer-motion";
import { useBookNav } from "./BookNav";
import PullCord, { type CordDraw } from "./PullCord";
import { holds, readingPoint } from "./timeline";
import type { SpreadId } from "@light/lib/site";

/* ==================================================================
   RIBBON — a satin bookmark hanging at the top right.

   It sways as the page moves and shows the chapter you are in, stitched
   in gold near its tail. Pull it down and let go and the book turns to
   the next chapter, the way you would find your place by the ribbon.
   ================================================================== */

const CHAPTER: Record<SpreadId, string> = {
    cover: "Cover",
    about: "About",
    work: "Work",
    "projects-intro": "Selected work",
    popup: "Projects",
    contact: "Contact",
    closed: "The end",
};

/* The hold at or before progress p. */
function holdAt(p: number) {
    let current = holds[0];
    for (const h of holds) if (h.from <= p) current = h;
    return current;
}

const draw: (label: string) => CordDraw = (label) => (ctx, rope) => {
    const pts = rope.pts;
    const n = pts.length;
    const half = 9;

    /* Edges of the strip, from each point's normal. */
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(n - 1, i + 1)];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d;
        const ny = dx / d;
        left.push({ x: pts[i].x + nx * half, y: pts[i].y + ny * half });
        right.push({ x: pts[i].x - nx * half, y: pts[i].y - ny * half });
    }

    /* Satin: each segment's shade follows how far it leans, so a sway reads
       as light sliding along the fabric. */
    for (let i = 0; i < n - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        const lean = Math.atan2(dx, dy);
        const l = Math.max(0, Math.min(1, 0.45 + lean * 1.6));
        const r = Math.round(62 + l * 70);
        const g = Math.round(36 + l * 44);
        const b = Math.round(22 + l * 30);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.moveTo(left[i].x, left[i].y);
        ctx.lineTo(left[i + 1].x, left[i + 1].y);
        ctx.lineTo(right[i + 1].x, right[i + 1].y);
        ctx.lineTo(right[i].x, right[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 0.6;
        ctx.stroke();
    }

    /* The sheen: a thin light line along one edge. */
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = left[i].x * 0.72 + pts[i].x * 0.28;
        const y = left[i].y * 0.72 + pts[i].y * 0.28;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = "rgba(255, 228, 196, 0.28)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    /* The tail, cut into a V. */
    const tail = pts[n - 1];
    const prev = pts[n - 2];
    const dx = tail.x - prev.x;
    const dy = tail.y - prev.y;
    const d = Math.hypot(dx, dy) || 1;
    ctx.fillStyle = "rgb(88, 54, 34)";
    ctx.beginPath();
    ctx.moveTo(left[n - 1].x, left[n - 1].y);
    ctx.lineTo(left[n - 1].x + (dx / d) * 14, left[n - 1].y + (dy / d) * 14);
    ctx.lineTo(tail.x + (dx / d) * 5, tail.y + (dy / d) * 5);
    ctx.lineTo(right[n - 1].x + (dx / d) * 14, right[n - 1].y + (dy / d) * 14);
    ctx.lineTo(right[n - 1].x, right[n - 1].y);
    ctx.closePath();
    ctx.fill();

    /* The chapter, stitched in gold down the ribbon above the tail. */
    const at = pts[n - 7];
    const next = pts[n - 3];
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(Math.atan2(next.y - at.y, next.x - at.x));
    ctx.fillStyle = "#e3c47f";
    ctx.font = "600 9px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(label.toUpperCase().split("").join(String.fromCharCode(8202)), 0, 0.5);
    ctx.restore();
};

export default function Ribbon() {
    const { progress, scrollToProgress } = useBookNav();
    const [chapter, setChapter] = useState(() => holdAt(progress.get()));
    useMotionValueEvent(progress, "change", (p) => {
        const h = holdAt(p);
        if (h.spread !== chapter.spread) setChapter(h);
    });

    const next = holds[holds.indexOf(chapter) + 1];
    const goNext = () => {
        /* Past the last chapter, the ribbon takes you back to the cover. */
        const target = next ?? holds[0];
        scrollToProgress(readingPoint(target), { duration: next ? 2 : 3 });
    };

    return (
        <PullCord
            side="right"
            length={170}
            links={20}
            draw={draw(CHAPTER[chapter.spread])}
            onPull={goNext}
            buttonLabel={next ? `Next chapter: ${CHAPTER[next.spread]}` : "Back to the cover"}
        />
    );
}
