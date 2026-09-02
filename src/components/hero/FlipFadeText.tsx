"use client";

import { Fragment, memo, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

/* Per-letter 3D flip with a blur, adapted from the FlipFadeText component.

   Two things changed from the original:

   1. No timer. The original cycled an array of words on a setInterval, which
      cannot work here — every piece of text in this hero earns its place from
      the scroll position, and a clock-driven swap would drift out of sync with
      the footage within seconds. This takes an `active` flag instead, so the
      caller decides when it plays.

   2. Words, then letters — not a flat split("") in a flex row with a gap. The
      original's gap-based spacing has no concept of a word boundary, so a
      multi-word title would break mid-word on a narrow viewport and real
      spaces would collapse. Splitting to words first keeps each one
      unbreakable and lets normal text wrapping do its job. */

export const letterVariants = (duration: number): Variants => ({
    initial: {
        rotateX: 90,
        y: 20,
        opacity: 0,
        filter: "blur(8px)",
    },
    animate: {
        rotateX: 0,
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        transition: { duration, ease: [0.2, 0.65, 0.3, 0.9] },
    },
    exit: {
        rotateX: -90,
        y: -20,
        opacity: 0,
        filter: "blur(8px)",
        transition: { duration: duration * 0.67, ease: "easeIn" },
    },
});

const Letter = memo(function Letter({
    char,
    variants,
}: {
    char: string;
    variants: Variants;
}) {
    return (
        <motion.span
            variants={variants}
            style={{ display: "inline-block", transformStyle: "preserve-3d" }}
        >
            {char}
        </motion.span>
    );
});

export default function FlipFadeText({
    text,
    active,
    className,
    letterDuration = 0.6,
    staggerDelay = 0.055,
    exitStaggerDelay = 0.02,
    spread = 0.9,
    frozen = false,
}: {
    text: string;
    /** Plays in when true, flips away when false. Driven by scroll, not a timer. */
    active: boolean;
    className?: string;
    letterDuration?: number;
    staggerDelay?: number;
    exitStaggerDelay?: number;
    /** Longest the stagger may take end to end, in seconds. See below. */
    spread?: number;
    /**
     * Render the same DOM with no motion at all.
     *
     * Used for the lens copy in the projects section. The magnifier only lines
     * up if its copy lays out identically to the original, and per-letter
     * inline-blocks kern differently from a plain text node — so the copy has
     * to keep the exact same span structure. This gives that without mounting
     * a second set of motion components for every letter on the page.
     */
    frozen?: boolean;
}) {
    const reduced = useReducedMotion();
    const words = useMemo(() => text.split(" "), [text]);
    const letterCount = useMemo(
        () => words.reduce((n, w) => n + w.length, 0),
        [words],
    );

    const variants = useMemo(
        () => letterVariants(reduced ? 0 : letterDuration),
        [letterDuration, reduced],
    );

    /* A flat per-letter delay only works on short strings.

       At the hero's 0.055s a three-word title lands in about a second, but a
       150-character sentence would take over eight — the reader finishes it
       long before it finishes arriving. Capping the total spread and dividing
       it across the letters keeps short headings crisp and makes long copy
       scale down to a fast ripple instead. */
    const stagger = reduced
        ? 0
        : Math.min(staggerDelay, spread / Math.max(letterCount, 1));

    const container: Variants = {
        initial: {},
        animate: { transition: { staggerChildren: stagger } },
        exit: {
            transition: {
                staggerChildren: reduced
                    ? 0
                    : Math.min(exitStaggerDelay, spread / Math.max(letterCount, 1)),
            },
        },
    };

    if (frozen) {
        return (
            <span className={className} aria-label={text}>
                {words.map((word, wi) => (
                    <Fragment key={`${word}-${wi}`}>
                        <span
                            aria-hidden="true"
                            style={{ display: "inline-block", whiteSpace: "nowrap" }}
                        >
                            {Array.from(word).map((char, ci) => (
                                <span key={ci} style={{ display: "inline-block" }}>
                                    {char}
                                </span>
                            ))}
                        </span>
                        {wi < words.length - 1 ? " " : null}
                    </Fragment>
                ))}
            </span>
        );
    }

    return (
        /* aria-label carries the real string and the letters are hidden from
           assistive tech — otherwise a screen reader spells the title out one
           character at a time. Same treatment as SplitText elsewhere. */
        <motion.span
            className={className}
            aria-label={text}
            initial="initial"
            animate={active ? "animate" : "exit"}
            variants={container}
            /* The children rotate in 3D, so they need a perspective to rotate
               within — without it the flip flattens into a vertical squash. */
            style={{ display: "block", perspective: 800 }}
        >
            {words.map((word, wi) => (
                <Fragment key={`${word}-${wi}`}>
                    <span
                        aria-hidden="true"
                        style={{ display: "inline-block", whiteSpace: "nowrap" }}
                    >
                        {Array.from(word).map((char, ci) => (
                            <Letter key={ci} char={char} variants={variants} />
                        ))}
                    </span>
                    {/* The separator sits BETWEEN the word spans, never inside
                        one. A trailing space inside an inline-block with
                        white-space: nowrap is trimmed by the browser, which
                        silently welded the words together — "not demoed"
                        rendered as "notdemoed". Out here it is a real text node
                        and the title can still wrap at word boundaries. */}
                    {wi < words.length - 1 ? " " : null}
                </Fragment>
            ))}
        </motion.span>
    );
}
