/* ==================================================================
   MON

   The navigation marks, drawn on the same grid and at the same stroke
   weight as the crest in Kamon.tsx, so the dock reads as one set cut by
   one hand rather than as icons picked from a library.

   THEY CARRY NO RING. The crest has one; these do not, because in the
   dock the ring is the *active* state, drawn in vermilion around
   whichever mark is current. Giving every mark its own ring would leave
   two concentric circles on the active item at 20px, and the state
   would stop reading. So the ring means "you are here", and nothing
   else in the system is allowed to draw one.

   Each mark stays inside r=10 of the 24 grid so that active ring
   circumscribes it with even air on every side.

   On abstraction: these are the everyday objects redrawn under kamon
   construction rules (symmetry, one weight, no perspective), not
   invented heraldry. A visitor still has to know which button goes to
   the work, and the dock's tooltips are a second affordance, not the
   only one.
   ================================================================== */

import { MON_GRID } from "./Kamon";

const STROKE = 2.2;

export type MonName = "home" | "about" | "projects" | "contact";

const PATHS: Record<MonName, React.ReactNode> = {
    /* The same mountain as the crest, unringed. Home is the identity, so its
       mark is the crest itself rather than a house. */
    home: (
        <>
            <path d="M7.2 16.4 12 6.9l4.8 9.5" />
            <path d="M9.3 13.2h5.4" />
        </>
    ),

    /* A person, reduced to the two circles-and-arcs a crest is allowed: the
       head on the axis, the shoulders as one symmetric arc beneath it. */
    about: (
        <>
            <circle cx="12" cy="9" r="3.1" />
            <path d="M6.2 17.6a5.8 5.8 0 0 1 11.6 0" />
        </>
    ),

    /* A masu, the square measuring box, seen corner-on as crests always draw
       it. Nested diamonds: the container and what it holds. */
    projects: (
        <>
            <path d="M12 4.6 19.4 12 12 19.4 4.6 12Z" />
            <path d="M12 9.1 14.9 12 12 14.9 9.1 12Z" />
        </>
    ),

    /* A folded letter. The rectangle is the paper and the V is the fold, which
       is the whole envelope with nothing left to remove. */
    contact: (
        <>
            <rect x="4.7" y="6.6" width="14.6" height="10.8" rx="0.8" />
            <path d="M5.4 7.7 12 12.9l6.6-5.2" />
        </>
    ),
};

export default function Mon({
    name,
    size = 20,
    className,
}: {
    name: MonName;
    size?: number | string;
    className?: string;
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
            /* Always decorative: every call site pairs the mark with a real
               accessible name on the control that owns it. */
            aria-hidden="true"
        >
            {PATHS[name]}
        </svg>
    );
}
