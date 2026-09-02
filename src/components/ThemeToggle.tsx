"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark";

export default function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>("dark");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reduced = useReducedMotion();

    /* False until the user actually presses the button.

       State starts at "dark" and the effect below corrects it to whatever the
       blocking script already put on <html>. For a light-mode visitor that is a
       real state change one tick after mount, and framer-motion animates it —
       so the button rendered as a moon and then morphed into a sun on every
       single page load. Gating the duration on this makes the mount-time
       correction instant while leaving genuine toggles animated. */
    const [interactive, setInteractive] = useState(false);

    /* SVG url(#…) references resolve across the whole document, not per
       component, so a hardcoded id would collide the moment a second instance
       rendered and one button would clip against the other's path. React's
       generated ids contain colons, which are legal in an id attribute but
       awkward inside url(), so they come out here. */
    const clipId = `theme-clip-${useId().replace(/:/g, "")}`;

    /* The blocking script in layout.tsx already set data-theme before paint.
       We only read it here so React state agrees with the DOM. */
    useEffect(() => {
        const current = document.documentElement.dataset.theme as Theme | undefined;
        if (current) setTheme(current);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    function toggle() {
        const root = document.documentElement;
        const next: Theme = theme === "dark" ? "light" : "dark";

        /* Batched with the theme change below, so the longer duration is already
           in place for the render that flips the icon. */
        setInteractive(true);

        /* Switch on the universal colour transition, flip, then switch it back
           off. The expensive selector only exists while the swap is running. */
        root.classList.add("theme-switching");

        root.dataset.theme = next;
        try {
            localStorage.setItem("theme", next);
        } catch {
            /* Private mode or blocked storage — the theme still applies for
               this session, it just won't be remembered. */
        }
        setTheme(next);

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            root.classList.remove("theme-switching");
        }, 520);
    }

    const isDark = theme === "dark";

    /* framer-motion does not read the reduced-motion override in globals.css —
       that only reaches CSS transitions and animations. Collapsing the duration
       is what actually honours the preference here. */
    const transition = {
        ease: "easeInOut" as const,
        duration: reduced || !interactive ? 0 : 0.35,
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
