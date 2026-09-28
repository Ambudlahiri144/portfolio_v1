/* ==================================================================
   VERLET ROPE — the physics under the ribbon and the lamp chain.

   A chain of points joined by fixed-length links, hung from an anchor.
   Verlet integration keeps each point's velocity implicit in the gap
   between where it is and where it was, which is what makes cloth and
   chains in so many demos (ThreeUI's Cloth Study among them) stable
   with nothing but "move, then satisfy the lengths a few times".

   No rendering here; the ribbon and the chain draw it their own way.
   ================================================================== */

export type RopePoint = { x: number; y: number; px: number; py: number };

export class Rope {
    readonly pts: RopePoint[];
    /* Held by the pointer: the last point follows this instead of physics. */
    grab: { x: number; y: number } | null = null;

    constructor(
        public anchorX: number,
        public anchorY: number,
        count: number,
        public segment: number,
        public damping = 0.985,
        public gravity = 0.55,
    ) {
        this.pts = Array.from({ length: count }, (_, i) => ({
            x: anchorX,
            y: anchorY + i * segment,
            px: anchorX,
            py: anchorY + i * segment,
        }));
    }

    /* How far the end hangs below where it would rest. */
    stretch() {
        const tail = this.pts[this.pts.length - 1];
        return tail.y - (this.anchorY + (this.pts.length - 1) * this.segment);
    }

    step({
        wind = 0,
        push,
        maxStretch = 1.6,
    }: {
        /* Horizontal force on every point, e.g. from scroll velocity. */
        wind?: number;
        /* A pointer: points within `r` are pushed away from it. */
        push?: { x: number; y: number; r: number; strength: number };
        /* How far a grabbed end may be pulled, as a multiple of the length. */
        maxStretch?: number;
    }) {
        const n = this.pts.length;
        for (let i = 1; i < n; i++) {
            const p = this.pts[i];
            /* The lower a point, the more the wind moves it. */
            const reach = i / (n - 1);
            const vx = (p.x - p.px) * this.damping + wind * reach;
            const vy = (p.y - p.py) * this.damping + this.gravity;
            p.px = p.x;
            p.py = p.y;
            p.x += vx;
            p.y += vy;
            if (push) {
                const dx = p.x - push.x;
                const dy = p.y - push.y;
                const d = Math.hypot(dx, dy);
                if (d < push.r && d > 0.01) {
                    const f = (1 - d / push.r) * push.strength;
                    p.x += (dx / d) * f;
                    p.y += (dy / d) * f * 0.4;
                }
            }
        }

        const first = this.pts[0];
        first.x = first.px = this.anchorX;
        first.y = first.py = this.anchorY;

        if (this.grab) {
            /* The end follows the hand, but a cord only stretches so far. */
            const tail = this.pts[n - 1];
            const dx = this.grab.x - this.anchorX;
            const dy = this.grab.y - this.anchorY;
            const d = Math.hypot(dx, dy);
            const max = this.segment * (n - 1) * maxStretch;
            const k = d > max ? max / d : 1;
            tail.x = this.anchorX + dx * k;
            tail.y = this.anchorY + dy * k;
        }

        /* Satisfy the link lengths. While grabbed the links may stretch a
           little, which reads as the cord taking the strain. */
        const slack = this.grab ? 1.35 : 1;
        for (let iter = 0; iter < 10; iter++) {
            for (let i = 0; i < n - 1; i++) {
                const a = this.pts[i];
                const b = this.pts[i + 1];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.hypot(dx, dy) || 0.0001;
                const target = this.segment * slack;
                if (d <= target && this.grab) continue;
                const diff = (d - target) / d;
                const aFixed = i === 0;
                const bFixed = i + 1 === n - 1 && !!this.grab;
                if (aFixed && bFixed) continue;
                if (aFixed) {
                    b.x -= dx * diff;
                    b.y -= dy * diff;
                } else if (bFixed) {
                    a.x += dx * diff;
                    a.y += dy * diff;
                } else {
                    a.x += dx * diff * 0.5;
                    a.y += dy * diff * 0.5;
                    b.x -= dx * diff * 0.5;
                    b.y -= dy * diff * 0.5;
                }
            }
            first.x = this.anchorX;
            first.y = this.anchorY;
        }
    }
}
