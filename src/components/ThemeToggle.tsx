"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark";

export default function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>("dark");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    return (
        <button
            type="button"
            onClick={toggle}
            className={styles.toggle}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={isDark}
        >
            {/* Both icons are always in the DOM and cross-fade on transform +
          opacity, so the swap has nothing to lay out or repaint. */}
            <span className={styles.stack} aria-hidden="true">
                <svg
                    className={`${styles.icon} ${isDark ? styles.on : styles.off}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M20.2 14.4A8.7 8.7 0 0 1 9.6 3.8a8.7 8.7 0 1 0 10.6 10.6Z" />
                </svg>

                <svg
                    className={`${styles.icon} ${isDark ? styles.off : styles.on}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="4.3" />
                    <path d="M12 2.6v2.1M12 19.3v2.1M21.4 12h-2.1M4.7 12H2.6M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5M18.6 18.6l-1.5-1.5M6.9 6.9 5.4 5.4" />
                </svg>
            </span>

            <span className={styles.sr}>{isDark ? "Dark" : "Light"}</span>
        </button>
    );
}