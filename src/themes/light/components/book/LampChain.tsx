"use client";

import { useState } from "react";
import { themeCookie } from "@/themes/config";
import PullCord, { type CordDraw } from "./PullCord";
import styles from "./Atmosphere.module.css";

/* ==================================================================
   LAMP CHAIN — the theme switch, as the pull chain of a desk lamp.

   A brass bead chain with an acorn pull hangs at the top left. Pull it
   and the lamp goes out: the room darkens around the book in about
   700 ms, a little moonlight left in the corners, and the site comes back
   as its dark self. Same cookie and reload as ThemeToggle.tsx, which
   stays in the dock as the plain control.
   ================================================================== */

const DIM_MS = 720;

const drawChain: CordDraw = (ctx, rope) => {
    const pts = rope.pts;
    const n = pts.length;

    /* Links between the beads: a hairline of darker brass. */
    ctx.strokeStyle = "rgba(96, 70, 34, 0.9)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();

    /* Beads: small brass balls, lit from the upper left like everything
       else on the table. */
    for (let i = 1; i < n - 1; i++) {
        const p = pts[i];
        const g = ctx.createRadialGradient(p.x - 0.9, p.y - 0.9, 0.2, p.x, p.y, 2.6);
        g.addColorStop(0, "#fff1c8");
        g.addColorStop(0.45, "#c9a15a");
        g.addColorStop(1, "#6f5024");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
        ctx.fill();
    }

    /* The acorn pull: a brass drop, turned to hang along the chain. */
    const tail = pts[n - 1];
    const prev = pts[n - 2];
    const angle = Math.atan2(tail.y - prev.y, tail.x - prev.x) - Math.PI / 2;
    ctx.save();
    ctx.translate(tail.x, tail.y);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(-6, 0, 6, 0);
    g.addColorStop(0, "#fbe8b6");
    g.addColorStop(0.4, "#c29752");
    g.addColorStop(1, "#5e421d");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.bezierCurveTo(6.5, 4, 6.5, 15, 0, 19);
    ctx.bezierCurveTo(-6.5, 15, -6.5, 4, 0, 1);
    ctx.fill();
    /* Its cap. */
    ctx.fillStyle = "#8a6a34";
    ctx.fillRect(-3, 0, 6, 2.2);
    ctx.restore();
};

export default function LampChain() {
    const [dimming, setDimming] = useState(false);

    const switchOff = () => {
        if (dimming) return;
        setDimming(true);
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.setTimeout(
            () => {
                document.cookie = `${themeCookie}=dark; path=/; max-age=31536000; samesite=lax`;
                window.location.reload();
            },
            reduced ? 0 : DIM_MS,
        );
    };

    return (
        <>
            <PullCord
                side="left"
                length={150}
                links={24}
                threshold={40}
                draw={drawChain}
                onPull={switchOff}
                buttonLabel="Switch off the lamp"
            />
            {dimming && <div className={styles.lampOff} aria-hidden="true" />}
        </>
    );
}
