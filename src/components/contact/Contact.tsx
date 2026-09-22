"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import TempleNightScene, { type ForegroundBounds } from "@/shaders/temple-night/TempleNightScene";
import ContactForm from "./ContactForm";
import styles from "./Contact.module.css";

/* ==================================================================
   CONTACT — a writing surface set down in a shrine garden at night

   THREE LAYERS, IN THIS ORDER, and the order is the design:

     0  the world         temple, gate, stairs, moon, trees, sky
     1  the form          ordinary HTML, fully accessible, in normal flow
     2  the near garden   the grass and rock nearest the lens

   The world is one opaque WebGL canvas, and nothing can be stacked
   between things drawn inside a single canvas. So the renderer draws the
   plates nearest the camera into a second, transparent canvas, and the
   host places it above the form. The grass then genuinely passes in front
   of the panel's lower edge — the same grass, from the same frame and the
   same instant of sway, not a drawing of grass laid over a drawing.

   THE CARD IS PLACED BY THE GRASS, NOT BY A NUMBER. The panel keeps an
   empty decorative base under its last control, and the grass may only
   ever cross that base. Where the grass stands on screen depends on the
   camera, and the camera's framing depends on the section's own height —
   which changes whenever a tab, an error or a dragged-out textarea needs
   more room. A fixed gap would be right at one height and put a blade
   across the submit button at another. So the renderer measures the real
   grass line on settle, and the card's bottom edge is set from it.

   On narrow screens the lift is switched off: the plates go back into the
   world behind the form. There is no room on a phone for grass to cross
   a panel without reaching its controls, and the skill that specifies
   this treatment prefers no overlap there to a hidden control.

   The heading is screen-reader-only on purpose: a section landmark needs
   one, and the form already carries a visible heading of its own.
   ================================================================== */

/* How far the grass may cross the card's bottom edge at its worst, and how
   much higher than a single measurement it can reach. The margin is
   measured, not guessed: across the camera's four parallax extremes and
   the full sway cycle the crest moved by 11px.

   The arithmetic, with the card's 48px decorative base:
     tallest reach   = measured crest - 12
     card bottom     = tallest reach + 28     (worst-case overlap 28px)
     lowest control  = card bottom - 48 = tallest reach - 20
   so no blade, at any sway or parallax, comes within 20px of a control.
   Measured against rendered pixels it stays well above that — a single
   probe never catches the sway at its tallest, which is what the 12px
   margin is for. */
const OVERLAP = 28;
const SWAY_MARGIN = 12;
/* Never closer to the section's bottom than this, whatever the grass says —
   the dock floats down there. */
const MIN_GAP = 112;

const WIDE = "(min-width: 1024px)";
const subscribeWide = (onChange: () => void) => {
    const mql = window.matchMedia(WIDE);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
};
/* useSyncExternalStore, as useReducedMotion does, so the value is right on
   the first client render and nothing mounts twice. The server assumes a
   narrow screen: that only means the lift starts off for an instant. */
const useWide = () =>
    useSyncExternalStore(
        subscribeWide,
        () => window.matchMedia(WIDE).matches,
        () => false,
    );

export default function Contact() {
    const wide = useWide();
    const sectionRef = useRef<HTMLElement>(null);
    const layoutRef = useRef<HTMLDivElement>(null);

    const placeByGrass = useCallback((bounds: ForegroundBounds) => {
        const section = sectionRef.current;
        const layout = layoutRef.current;
        const card = layout?.firstElementChild as HTMLElement | null;
        if (!section || !layout || !card) return;

        const s = section.getBoundingClientRect();
        const c = card.getBoundingClientRect();
        /* The canvases fill the section, so the measurement maps onto it
           directly — scaled only in case the two boxes disagree by a pixel. */
        const sx = s.width / bounds.width;
        const sy = s.height / bounds.height;
        const colW = (bounds.width / bounds.top.length) * sx;

        /* The highest blade anywhere across the card's width. */
        let crest = Infinity;
        for (let i = 0; i < bounds.top.length; i++) {
            const x0 = i * colW, x1 = x0 + colW;
            if (x1 < c.left - s.left || x0 > c.right - s.left) continue;
            crest = Math.min(crest, bounds.top[i] * sy);
        }
        if (!Number.isFinite(crest) || crest >= s.height) {
            layout.style.removeProperty("--grass-gap");
            return;
        }

        /* Card bottom = the tallest the grass can reach, plus the overlap.
           Everything else follows from the card's own 48px base. */
        const cardBottom = crest - SWAY_MARGIN + OVERLAP;
        const gap = Math.max(MIN_GAP, Math.round(s.height - cardBottom));

        /* A small dead band. Moving the card can change the section's
           height, which re-measures; without this the two would chase each
           other by single pixels. */
        const current = parseFloat(layout.style.getPropertyValue("--grass-gap"));
        if (!Number.isFinite(current) || Math.abs(current - gap) > 2) {
            layout.style.setProperty("--grass-gap", `${gap}px`);
        }
    }, []);

    return (
        <section id="contact" ref={sectionRef} className={styles.section}>
            <TempleNightScene
                className={styles.scene}
                foregroundClassName={styles.foreground}
                liftForeground={wide}
                onForegroundBounds={placeByGrass}
            />

            <h2 className={styles.sr}>Contact</h2>

            {/* Normal flow. The form decides how tall the section is — a long
                tab, an error message or a resized textarea grows the page
                rather than being clipped or scrolled inside a box. */}
            <div ref={layoutRef} className={styles.layout}>
                <ContactForm />
            </div>
        </section>
    );
}
