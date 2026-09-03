"use client";

import { useRef, useState } from "react";
import {
    useScroll,
    useSpring,
    useTransform,
    useMotionValueEvent,
    motion,
} from "framer-motion";
import FlipFadeText from "./FlipFadeText";
import SequenceCanvas from "../sequence/SequenceCanvas";
import { useFrameSequence } from "../sequence/useFrameSequence";
import {
    heroBeats,
    heroIntro,
    heroSequence,
    site,
    type HeroBeat,
} from "@/lib/site";
import { useReducedMotion } from "@/lib/useReducedMotion";
import styles from "./SequenceHero.module.css";

const {
    count: FRAME_COUNT,
    background: BG,
    seqEnd: SEQ_END,
    slideTo: SLIDE_TO,
    slideEnd: SLIDE_END,
} = heroSequence;

function framePath(i: number, small: boolean) {
    const n = String(i + 1).padStart(3, "0");
    return small ? `/hero-motion/sm/frame-${n}.webp` : `/hero-motion/frame-${n}.webp`;
}

/* Split into two components on purpose.

   Hooks cannot be called conditionally, so a single component would have to run
   useScroll even when rendering the reduced-motion branch — where its target ref
   is never attached to anything, and Motion throws "Target ref is defined but
   not hydrated". The same applies to the 205-frame preload: it has no business
   running for a fallback that shows one still image. Choosing the component
   rather than branching inside one keeps each path honest. */
export default function SequenceHero() {
    const reduced = useReducedMotion();
    return reduced ? <StaticHero /> : <ScrollHero />;
}

/* ------------------------------------------------------------------
   Reduced motion: one still, all beats as ordinary stacked text.
   No 400vh, no canvas, no frame loop, no 205-image download.
   ------------------------------------------------------------------ */
function StaticHero() {
    return (
        <section id="top" className={styles.static}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={framePath(FRAME_COUNT - 1, false)}
                alt={`${site.name} — ${site.tagline}`}
                className={styles.staticImage}
            />
            <div className={styles.staticCopy}>
                {heroBeats.map((beat) => (
                    <div key={beat.title} className={styles.staticBeat}>
                        <h2 className={styles.staticTitle}>{beat.title}</h2>
                        <p className={styles.staticBody}>{beat.body}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
function ScrollHero() {
    const wrapRef = useRef<HTMLElement>(null);

    /* ---- preload ---------------------------------------------------- */
    /* Above the fold, so it starts immediately — no `enabled` gate. */
    const { imagesRef, progress, ready } = useFrameSequence({
        count: FRAME_COUNT,
        path: framePath,
    });

    /* ---- scroll ----------------------------------------------------- */
    const { scrollYProgress } = useScroll({
        target: wrapRef,
        offset: ["start start", "end end"],
    });

    /* Softer than the usual 100/30. A lower stiffness lets the frame index trail
       the scrollbar slightly and glide into place instead of snapping to it,
       which is what makes a scrubbed sequence read as footage rather than as a
       flipbook being dragged. */
    const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 28 });

    /* Percentage of the element's own width, so it scales with the viewport
       instead of sliding a fixed pixel distance that would be wrong on a phone. */
    const slideX = useTransform(
        smooth,
        [SEQ_END, SLIDE_END],
        ["0%", `${SLIDE_TO * 100}%`],
    );

    return (
        /* id="top" lives here because the dock's Home link points at /#top and
           the hero this replaces owned that anchor. */
        <section
            id="top"
            ref={wrapRef}
            className={styles.wrap}
            /* One source of truth for the footage's shape — the CSS band and the
               encoded frames are the same number. */
            style={{ "--aspect": heroSequence.aspect } as React.CSSProperties}
        >
            <div className={styles.sticky}>
                {/* The frame is pushed left once the sequence has played out,
                    clearing the right of the stage for the introduction. He is
                    centred on the last frame and the area he vacates is plain
                    black, so nothing is lost off the left edge. */}
                <motion.div className={styles.shift} style={{ x: slideX }}>
                    {/* contain, never cover. The sequence is 16:9 and the frame
                        is the whole composition — a cover crop on a phone would
                        slice the subject off at the sides. */}
                    <SequenceCanvas
                        className={styles.canvas}
                        imagesRef={imagesRef}
                        progress={smooth}
                        count={FRAME_COUNT}
                        /* Frames run out at SEQ_END, not at 1 — the remaining
                           scroll is the slide and the introduction, which hold
                           on the final frame. */
                        seqEnd={SEQ_END}
                        background={BG}
                        fit="contain"
                        revision={ready}
                    />
                </motion.div>

                {/* The canvas is decorative; this carries the meaning for anyone
                    who cannot see it, and for crawlers. */}
                <h1 className={styles.sr}>
                    {site.name} — {site.role}. {site.tagline}
                </h1>

                {heroBeats.map((beat) => (
                    <Beat key={beat.title} beat={beat} progress={smooth} />
                ))}

                <Intro progress={smooth} />

                <ScrollCue progress={smooth} />

                {!ready && (
                    <div className={styles.loader} role="status" aria-live="polite">
                        <span className={styles.spinner} aria-hidden="true" />
                        <span className={styles.loaderBar} aria-hidden="true">
                            <span
                                className={styles.loaderFill}
                                style={{ transform: `scaleX(${progress})` }}
                            />
                        </span>
                        <span className={styles.loaderText}>
                            {Math.round(progress * 100)}%
                        </span>
                    </div>
                )}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */

function Beat({
    beat,
    progress,
}: {
    beat: HeroBeat;
    progress: ReturnType<typeof useSpring>;
}) {
    const { from, to } = beat;
    /* Fade in over the first slice of the beat's range, hold, fade out over the
       last — so a beat is never mid-fade while it is the only thing on screen. */
    const opacity = useTransform(
        progress,
        [from, from + 0.04, to - 0.04, to],
        [0, 1, 1, 0],
    );
    const y = useTransform(
        progress,
        [from, from + 0.04, to - 0.04, to],
        [20, 0, 0, -20],
    );

    /* A boolean, not a per-frame value. The flip is a discrete entrance, so it
       only needs to know when the beat crosses into its range — the setState is
       guarded so scrolling inside the range does not re-render on every frame. */
    const [active, setActive] = useState(false);
    useMotionValueEvent(progress, "change", (v) => {
        const next = v >= from && v <= to;
        setActive((prev) => (prev === next ? prev : next));
    });

    return (
        <motion.div
            className={`${styles.beat} ${styles[beat.align]}`}
            style={{ opacity, y }}
        >
            <div className={styles.beatInner}>
                {/* The title flips letter by letter; the body keeps the plain
                    fade. Flipping a full sentence one character at a time reads
                    as noise and actively hurts reading it. */}
                <h2 className={styles.beatTitle}>
                    <FlipFadeText text={beat.title} active={active} />
                </h2>
                <p className={styles.beatBody}>{beat.body}</p>
            </div>
        </motion.div>
    );
}

/* The closing introduction — the beat the footage used to carry as baked-in
   pixels. Same type treatment as the beats above, but it holds to the end of
   the scroll instead of fading out. */
function Intro({ progress }: { progress: ReturnType<typeof useSpring> }) {
    const { from } = heroIntro;
    const opacity = useTransform(progress, [from, from + 0.06], [0, 1]);
    const y = useTransform(progress, [from, from + 0.06], [24, 0]);

    /* Holds once reached — this is the closing beat, so it never flips away. */
    const [active, setActive] = useState(false);
    useMotionValueEvent(progress, "change", (v) => {
        const next = v >= from;
        setActive((prev) => (prev === next ? prev : next));
    });

    return (
        <motion.div className={styles.intro} style={{ opacity, y }}>
            <div className={styles.introInner}>
                <p className={styles.introEyebrow}>{heroIntro.eyebrow}</p>
                <p className={styles.introName}>
                    <FlipFadeText
                        text={heroIntro.name}
                        active={active}
                        /* Slower and wider apart than the beats: this is the
                           payoff line, and it has the stage to itself. */
                        letterDuration={0.7}
                        staggerDelay={0.07}
                    />
                </p>
                <p className={styles.introBody}>{heroIntro.body}</p>
            </div>
        </motion.div>
    );
}

function ScrollCue({ progress }: { progress: ReturnType<typeof useSpring> }) {
    const opacity = useTransform(progress, [0, 0.06], [1, 0]);
    return (
        <motion.div className={styles.cue} style={{ opacity }} aria-hidden="true">
            <span className={styles.cueRule} />
            {site.scrollCue}
        </motion.div>
    );
}
