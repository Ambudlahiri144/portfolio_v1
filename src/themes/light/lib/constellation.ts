/* ------------------------------------------------------------------
   Constellation geometry.

   Everything here runs once at module load and never again — no work
   per frame, no work per render. Same discipline as the CSS globe in
   Techglobe.tsx, which this is the WebGL sibling of.
   ------------------------------------------------------------------ */

/* Two separate populations, on purpose.

   A single 3000-point field with nearest-neighbour links would need ~9M
   distance comparisons to build, which is far too much to spend on the main
   thread at import time. It also looks wrong: 3000 linked nodes is a hairball,
   not a constellation.

   So the field is split. DUST is a large unlinked cloud that supplies depth and
   parallax for almost nothing — just a position buffer. NODES is a small set
   that actually carries edges, few enough that the links stay legible and the
   O(n²) build is trivial (80² = 6400 comparisons). */
const DUST_COUNT = 2400;
const NODE_COUNT = 150;

/* Radius of the field. The camera sits inside it and moves along -Z, so this
   also determines how long the fly-through can run before it exits the cloud. */
const RADIUS = 26;
const DEPTH = 60;

/* Neighbours per node. 2 gives long sparse chains; 3 starts to read as a mesh.
   Matches the default in Techglobe's buildLinks. */
const NEIGHBOURS = 2;

/* Hard ceiling on edge length.

   Nearest-neighbour alone is not enough in a volume this size. A node in a
   sparse pocket still gets linked to its two closest companions even when those
   are thirty units away, and the result is a handful of enormous lines that
   rake across the whole viewport — including straight through the headline.
   Dropping over-long edges leaves those nodes unconnected, which reads as
   isolated stars and is exactly what a constellation should look like. */
const MAX_EDGE = 8.5;

/* Deterministic PRNG so the layout is identical on every load. A Math.random
   field reshuffles on each navigation, which reads as flicker rather than as
   the same place seen again. */
function mulberry32(seed: number) {
    let a = seed;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type Point = { x: number; y: number; z: number };

/* Rejection-sampled disc, extruded along Z.

   Techglobe's spherePoints places points on a sphere *surface*, which is right
   for a globe you look at and wrong for a field you fly through — a shell would
   part around the camera and leave the middle empty. This fills a volume
   instead, so there is always something at every depth. */
function volumePoints(count: number, rand: () => number): Point[] {
    const points: Point[] = [];
    while (points.length < count) {
        const x = (rand() * 2 - 1) * RADIUS;
        const y = (rand() * 2 - 1) * RADIUS;
        if (x * x + y * y > RADIUS * RADIUS) continue;
        points.push({ x, y, z: (rand() * 2 - 1) * DEPTH });
    }
    return points;
}

/* Connect every node to its k nearest neighbours, deduped.

   Ported from Techglobe.tsx:98 — same shape, same Set-based dedupe. It emits a
   flat pair list here instead of transform metadata, because three.js wants a
   position buffer rather than CSS rotations. */
function buildEdges(points: Point[], k: number): [Point, Point][] {
    const seen = new Set<string>();
    const edges: [Point, Point][] = [];
    /* Compared squared throughout — the sort and the cap both only need
       ordering, and skipping ~300 square roots is free accuracy. */
    const maxSq = MAX_EDGE * MAX_EDGE;

    points.forEach((a, i) => {
        points
            .map((b, j) => ({
                j,
                d: (b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2,
            }))
            .filter((o) => o.j !== i && o.d <= maxSq)
            .sort((p, q) => p.d - q.d)
            .slice(0, k)
            .forEach(({ j }) => {
                const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                if (seen.has(key)) return;
                seen.add(key);
                edges.push([points[i], points[j]]);
            });
    });

    return edges;
}

function toBuffer(points: Point[]): Float32Array {
    const out = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
        out[i * 3] = p.x;
        out[i * 3 + 1] = p.y;
        out[i * 3 + 2] = p.z;
    });
    return out;
}

const rand = mulberry32(0x5eed);

const dust = volumePoints(DUST_COUNT, rand);
const nodes = volumePoints(NODE_COUNT, rand);
const edges = buildEdges(nodes, NEIGHBOURS);

/* Per-particle scatter for the dust, so they twinkle out of phase rather than
   pulsing in unison. Precomputed for the same reason as everything else here. */
const dustPhase = new Float32Array(DUST_COUNT);
for (let i = 0; i < DUST_COUNT; i++) dustPhase[i] = rand() * Math.PI * 2;

export const DUST_POSITIONS = toBuffer(dust);
export const NODE_POSITIONS = toBuffer(nodes);
export const DUST_PHASE = dustPhase;

/* LineSegments consumes a flat vertex pair per edge — one draw call for the
   whole mesh rather than one per line. */
export const EDGE_POSITIONS = (() => {
    const out = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], i) => {
        out.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    });
    return out;
})();

export const FIELD_DEPTH = DEPTH;
export const EDGE_COUNT = edges.length;
