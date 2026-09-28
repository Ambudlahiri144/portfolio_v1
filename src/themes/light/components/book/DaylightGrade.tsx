"use client";

import { useEffect, useState } from "react";
import styles from "./Atmosphere.module.css";

/* ==================================================================
   DAYLIGHT GRADE — the window light follows the reader's own clock.

   Three blend layers over the book canvas, each faded in by how close
   the local time is to its part of the day:

     morning   cool and bright, the light high
     evening   golden, with the edges warmed and deepened
     night     a lamplit pool on the book, the room dark around it

   Noon is the footage as shot: no layer at all. The layers sit between
   the canvas and the page HTML, so the photographed paper is graded and
   the words on it never are. Night leaves the middle of the spread
   clear by design: the page's measured contrast holds at every hour.

   ?hour=19 overrides the clock, for looking at a time of day on demand.
   ================================================================== */

/* A smooth 0..1 bump centred on `at`, reaching zero `half` hours away. */
function bump(h: number, at: number, half: number) {
    const d = Math.min(Math.abs(h - at), 24 - Math.abs(h - at));
    const t = Math.max(0, 1 - d / half);
    return t * t * (3 - 2 * t);
}

export function gradeFor(h: number) {
    return {
        morning: bump(h, 8.5, 3.2),
        evening: bump(h, 18.2, 2.6),
        /* Night spans midnight: centred on 1:00, flat through the small
           hours, gone by breakfast. */
        night: Math.min(1, bump(h, 1, 5.5) * 1.6),
    };
}

function currentHour() {
    if (typeof window === "undefined") return 12;
    const q = new URLSearchParams(window.location.search).get("hour");
    if (q !== null && !Number.isNaN(Number(q))) return Number(q) % 24;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
}

export default function DaylightGrade() {
    /* Noon (no grade) on the server and the first client render: the time
       of day is only known in the browser, so it fades in after mount. */
    const [hour, setHour] = useState<number | null>(null);

    useEffect(() => {
        const tick = () => setHour(currentHour());
        const first = window.setTimeout(tick, 0);
        const every = window.setInterval(tick, 60_000);
        return () => {
            window.clearTimeout(first);
            window.clearInterval(every);
        };
    }, []);

    const g = hour === null ? { morning: 0, evening: 0, night: 0 } : gradeFor(hour);

    return (
        <div className={styles.grade} aria-hidden="true" data-hour={hour?.toFixed(1)}>
            <span className={styles.morning} style={{ opacity: g.morning }} />
            <span className={styles.evening} style={{ opacity: g.evening }} />
            <span className={styles.eveningEdge} style={{ opacity: g.evening }} />
            <span className={styles.nightRoom} style={{ opacity: g.night }} />
            <span className={styles.nightLamp} style={{ opacity: g.night }} />
        </div>
    );
}
