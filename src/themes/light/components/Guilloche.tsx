import { useMemo } from "react";
import styles from "./Guilloche.module.css";

/* ==================================================================
   GUILLOCHE — an engraved rosette, drawn by the same maths as the
   lathes that engrave banknotes and certificates.

   Each ring is a hypotrochoid, the path of a point on a small wheel
   rolling inside a larger one:
     x = (R - r) cos t + d cos(((R - r) / r) t)
     y = (R - r) sin t - d sin(((R - r) / r) t)
   A handful of these at slightly different pen distances (d), each
   rotated a little, interfere into the moiré a real engraving has.

   Pure SVG in ink hairlines. On a page of the book it draws itself on
   (stroke-dashoffset) when the page comes to rest; elsewhere it is
   simply there.
   ================================================================== */

type Ring = { R: number; r: number; d: number; turn: number };

function hypotrochoid({ R, r, d, turn }: Ring) {
    /* R and r are integers here, so the curve closes after r / gcd(R, r)
       turns of the big wheel. */
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const loops = r / gcd(R, r);
    const k = (R - r) / r;
    /* Enough points per loop that no facet shows at bookplate size. */
    const samples = 160 * loops;
    const pts: string[] = [];
    for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * Math.PI * 2 * loops;
        const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
        const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        pts.push(`${(x * c - y * s).toFixed(2)},${(x * s + y * c).toFixed(2)}`);
    }
    return `M${pts.join("L")}Z`;
}

const PRESETS: Record<"seal" | "plate", Ring[]> = {
    /* Round and open enough to read at 50-80 px: a university's seal.
       Fifteen petals (R / gcd = 15, four loops), three pen distances, and
       a small inner rosette. Denser rings (thirteen loops) are right for a
       large engraving and collapse into a dark disc at this size. */
    seal: [
        { R: 60, r: 16, d: 30, turn: 0 },
        { R: 60, r: 16, d: 24, turn: 0.1 },
        { R: 60, r: 16, d: 18, turn: 0.2 },
        { R: 36, r: 9, d: 8, turn: 0 },
    ],
    /* Open and wide: a bookplate's border rosette. */
    plate: [
        { R: 72, r: 17, d: 44, turn: 0 },
        { R: 72, r: 17, d: 38, turn: 0.05 },
        { R: 72, r: 17, d: 32, turn: 0.1 },
    ],
};

export default function Guilloche({
    preset = "seal",
    size = 64,
    className,
}: {
    preset?: keyof typeof PRESETS;
    size?: number;
    className?: string;
}) {
    const paths = useMemo(() => PRESETS[preset].map((ring) => hypotrochoid(ring)), [preset]);
    const extent = preset === "plate" ? 118 : 96;

    return (
        <svg
            className={`${styles.rosette} ${className ?? ""}`}
            width={size}
            height={size}
            viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
            aria-hidden="true"
        >
            {paths.map((d, i) => (
                <path key={i} d={d} pathLength={1} style={{ animationDelay: `${i * 160}ms` }} />
            ))}
            <circle r={extent - 4} className={styles.border} pathLength={1} />
        </svg>
    );
}
