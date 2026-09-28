/* ==================================================================
   VOLUMES — what stands on the shelf at /experience.

   One volume per entry in `work` and `education`, and one more, "The
   stack", holding every technology. The cloth colours are an old
   publisher's list (oxblood, forest, navy, ochre, sand) and the sizes
   vary a little, so the shelf reads as collected rather than generated.
   ================================================================== */

import { education, tech, work, type TimelineEntry } from "@light/lib/site";

export type Volume = {
    id: string;
    /* Stamped on the spine. */
    spine: string;
    period: string;
    kind: "work" | "education" | "stack";
    entry?: TimelineEntry;
    /* Bookcloth tint, or leather. */
    cloth: string;
    leather?: boolean;
    /* Height and thickness, cm. Depth is shared. */
    h: number;
    t: number;
};

export const DEPTH = 15.5;

/* Multiplied into the beige bookcloth weave, so each is set lighter than
   the colour it reads as. */
const CLOTH = ["#b0483a", "#5d8062", "#4f6690", "#d69a4a", "#efd6a6"];
const SIZES: [number, number][] = [
    [25, 4.2],
    [23.4, 3.6],
    [26, 4.8],
    [22.6, 3.2],
    [21.8, 3.4],
];

const entries: { e: TimelineEntry; kind: "work" | "education" }[] = [
    ...work.map((e) => ({ e, kind: "work" as const })),
    ...education.map((e) => ({ e, kind: "education" as const })),
];

export const volumes: Volume[] = [
    ...entries.map(({ e, kind }, i) => ({
        id: `${kind}-${i}`,
        spine: e.org.split(",")[0],
        period: e.period,
        kind,
        entry: e,
        cloth: CLOTH[i % CLOTH.length],
        h: SIZES[i % SIZES.length][0],
        t: SIZES[i % SIZES.length][1],
    })),
    {
        id: "stack",
        spine: "The stack",
        period: `${tech.length} technologies`,
        kind: "stack",
        cloth: "#c08a62",
        leather: true,
        h: 24,
        t: 2.8,
    },
];
