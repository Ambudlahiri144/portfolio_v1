"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@light/lib/useReducedMotion";
import { themeCookie, type Theme } from "@/themes/config";
import styles from "./ThemeToggle.module.css";

/* This copy only ever renders inside the light theme's tree. */
const CURRENT: Theme = "light";
const OTHER: Theme = "dark";

/* How long the icon gets to morph before the page reloads. Matches the
   motion duration below. */
const MORPH_MS = 350;

export default function ThemeToggle() {
    /* Starts on the theme this tree belongs to, so the server markup and the
       first client render agree — no mount-time correction, no flicker. It
       only changes when pressed, to play the morph before the reload. */
    const [theme, setTheme] = useState<Theme>(CURRENT);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reduced = useReducedMotion();

    /* SVG url(#…) references resolve across the whole document, not per
       component, so a hardcoded id would collide the moment a second instance
       rendered and one button would clip against the other's path. React's
       generated ids contain colons, which are legal in an id attribute but
       awkward inside url(), so they come out here. */
    const clipId = `theme-clip-${useId().replace(/:/g, "")}`;

    useEffect(() => {
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    /* The two themes are separate component trees, not two palettes on one
       tree, so there is nothing to flip in place. The choice goes into the
       cookie src/proxy.ts reads, and a reload fetches the other tree.

       A cookie rather than localStorage because the server has to know the
       theme before it renders anything. */
    function toggle() {
        if (theme !== CURRENT) return;

        document.cookie = `${themeCookie}=${OTHER}; path=/; max-age=31536000; samesite=lax`;
        setTheme(OTHER);

        timer.current = setTimeout(
            () => window.location.reload(),
            reduced ? 0 : MORPH_MS,
        );
    }

    const isDark = theme === "dark";

    /* framer-motion does not read the reduced-motion override in theme.css —
       that only reaches CSS transitions and animations. Collapsing the duration
       is what actually honours the preference here. */
    const transition = {
        ease: "easeInOut" as const,
        duration: reduced ? 0 : MORPH_MS / 1000,
    };

    return (
        <button
            type="button"
            onClick={toggle}
            className={styles.toggle}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={isDark}
        >
            {/* One shape, clipped. The path slides across the disc to bite a
                crescent out of it, so the sun becomes the moon rather than the
                two of them swapping places. The bite is transparent, which on
                this icon-only button shows the dock's glass through it. */}
            <svg
                className={styles.glyph}
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                fill="currentColor"
                strokeLinecap="round"
                viewBox="0 0 32 32"
            >
                <clipPath id={clipId}>
                    <motion.path
                        animate={{ y: isDark ? 14 : 0, x: isDark ? -11 : 0 }}
                        transition={transition}
                        d="M0-11h25a1 1 0 0017 13v30H0Z"
                    />
                </clipPath>

                <g clipPath={`url(#${clipId})`}>
                    {/* r is set as a plain attribute as well as animated.

                        With only `animate`, there is no r on the element until
                        framer-motion takes over on the client, so the server
                        markup carries r="undefined" and the browser rejects it:
                        `<circle> attribute r: Expected length, "undefined"`.
                        The static value is what the first paint uses; motion
                        overwrites it from there. */}
                    <motion.circle
                        cx="16"
                        cy="16"
                        r={isDark ? 10 : 8}
                        initial={false}
                        animate={{ r: isDark ? 10 : 8 }}
                        transition={transition}
                    />
                    <motion.g
                        animate={{
                            scale: isDark ? 0.5 : 1,
                            opacity: isDark ? 0 : 1,
                        }}
                        transition={transition}
                        stroke="currentColor"
                        strokeWidth="1.5"
                    >
                        <path d="M18.3 3.2c0 1.3-1 2.3-2.3 2.3s-2.3-1-2.3-2.3S14.7.9 16 .9s2.3 1 2.3 2.3zm-4.6 25.6c0-1.3 1-2.3 2.3-2.3s2.3 1 2.3 2.3-1 2.3-2.3 2.3-2.3-1-2.3-2.3zm15.1-10.5c-1.3 0-2.3-1-2.3-2.3s1-2.3 2.3-2.3 2.3 1 2.3 2.3-1 2.3-2.3 2.3zM3.2 13.7c1.3 0 2.3 1 2.3 2.3s-1 2.3-2.3 2.3S.9 17.3.9 16s1-2.3 2.3-2.3zm5.8-7C9 7.9 7.9 9 6.7 9S4.4 8 4.4 6.7s1-2.3 2.3-2.3S9 5.4 9 6.7zm16.3 21c-1.3 0-2.3-1-2.3-2.3s1-2.3 2.3-2.3 2.3 1 2.3 2.3-1 2.3-2.3 2.3zm2.4-21c0 1.3-1 2.3-2.3 2.3S23 7.9 23 6.7s1-2.3 2.3-2.3 2.4 1 2.4 2.3zM6.7 23C8 23 9 24 9 25.3s-1 2.3-2.3 2.3-2.3-1-2.3-2.3 1-2.3 2.3-2.3z" />
                    </motion.g>
                </g>
            </svg>

            <span className={styles.sr}>{isDark ? "Dark" : "Light"}</span>
        </button>
    );
}
