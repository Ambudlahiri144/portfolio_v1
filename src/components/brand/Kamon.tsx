/* ==================================================================
   KAMON

   The crest. A ring enclosing a mountain, which is both the initial of
   the name and a shape that belongs to the world: mountain crests
   (yama-gata) are a real family of kamon, so this is a construction
   rather than a costume.

   Built the way crests are actually built: one uniform stroke weight,
   bilateral symmetry, no perspective, no fills, everything on a circle
   and a straight line. That construction is why real crests survive
   being stamped at the size of a fingernail, and it is why this one
   stays legible at 14px next to a footer heading.

   Not to be confused with the hanko (public/brand/hanko-*.webp), which
   is a seal carrying the name in katakana and is a raster image because
   its letterforms come from a typeface. The crest is geometry, so it is
   geometry here.
   ================================================================== */

/* One grid for every mark in the system. The ring's outer edge sits at
   11.3 of 24, leaving a hair of margin so the shape never clips when a
   parent rounds its box. */
export const MON_GRID = 24;
const STROKE = 2.2;

export default function Kamon({
    size = 16,
    className,
    title,
}: {
    size?: number | string;
    className?: string;
    /** Supply only when the crest is the sole label for a control. */
    title?: string;
}) {
    return (
        <svg
            viewBox={`0 0 ${MON_GRID} ${MON_GRID}`}
            width={size}
            height={size}
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            role={title ? "img" : undefined}
            aria-hidden={title ? undefined : true}
        >
            {title ? <title>{title}</title> : null}
            <circle cx="12" cy="12" r="10.2" />
            {/* The mountain: apex on the vertical axis, feet on one baseline,
                one bar across. Read as an A by anyone who reads Latin, as a
                mountain by anyone who does not, and as a crest by both. */}
            <path d="M6.9 16.9 12 6.6l5.1 10.3" />
            <path d="M9.1 13.4h5.8" />
        </svg>
    );
}
