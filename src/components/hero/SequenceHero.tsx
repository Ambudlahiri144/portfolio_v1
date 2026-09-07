"use client";

import { useRef } from "react";
import {
    useScroll,
    useSpring,
    useTransform,
    useMotionValueEvent,
    motion,
} from "framer-motion";
import { useState } from "react";
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
import { useTheme, type Theme } from "@/lib/useTheme";
import scene from "../scene/scene.module.css";
import styles from "./SequenceHero.module.css";

/* ==================================================================
   HERO

   The way in. A camera pushing along a path toward a torii gate, and
   passing under it as the section ends.

   TWO WORLDS. Light is a mountain path at sunrise; dark is a Tokyo back
   alley in the rain. Both do the same move and arrive at the same gate,
   so flipping the theme mid-scroll changes the place without changing
   the shot. That is the whole reason the toggle exists now.

   MOTIVATION, in one sentence: you are walking somewhere, and the site
   begins by taking you through the entrance rather than showing you a
   picture of one.

   No WebGL. The camera move is rendered into the footage, so all the
   browser does is scrub it and lay type over it in a shared perspective.
   ================================================================== */

const { count: FRAME_COUNT, seqEnd: SEQ_END } = heroSequence;

/* One set per world, rendered by scripts/scene.mjs. The theme is part of
   the path, so a toggle is a different directory rather than a filter over
   the same pixels. */
function framePath(i: number, small: boolean, theme: Theme) {
    const n = String(i + 1).padStart(3, "0");
    return `/scene/hero/${theme}/${small ? "sm/" : ""}frame-${n}.webp`;
}

/* Split into two components on purpose. `useScroll` needs a mounted target
   and the static branch has no scroll track to measure, so the branch is on
   the component rather than inside one. */
export default function SequenceHero() {
    return useReducedMotion() ? <StaticHero /> : <ScrollHero />;
}

/* ------------------------------------------------------------------
   Reduced motion: the arrival, held. The last frame is the moment
   under the gate, which is the one frame worth keeping if you only
   keep one.
   ------------------------------------------------------------------ */
function StaticHero() {
    const theme = useTheme();
    return (
        <section id="top" className={styles.static}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={framePath(FRAME_COUNT - 1, false, theme)}
                alt=""
                aria-hidden="true"
                className={styles.staticImage}
            />
            <div className={styles.staticCopy}>
                <h1 className={styles.sr}>
                    {site.name}. {site.role}. {site.tagline}
                </h1>
                {heroBeats.map((beat) => (
                    <div key={beat.title} className={styles.staticBeat}>
                        <h2 className={styles.staticTitle}>{beat.title}</h2>
                        <p className={styles.staticBody}>{beat.body}</p>
                    </div>
                ))}
                <div className={styles.staticBeat}>
                    <p className={styles.introEyebrow}>{heroIntro.eyebrow}</p>
                    <h2 className={styles.staticTitle}>{heroIntro.name}</h2>
                    <p className={styles.staticBody}>{heroIntro.body}</p>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */

function ScrollHero() {
    const wrapRef = useRef<HTMLElement>(null);
    const theme = useTheme();

    /* Above the fold, so it starts immediately and reports progress. The
       other world follows on its own once this one is complete. */
    const { imagesRef, progress, ready, revision } = useFrameSequence({
        count: FRAME_COUNT,
        path: framePath,
        theme,
    });

    const { scrollYProgress } = useScroll({
        target: wrapRef,
        offset: ["start start", "end end"],
    });

    /* Softer than the usual 100/30. A lower stiffness lets the frame index
       trail the scrollbar slightly and glide into place instead of snapping
       to it, which is what makes a scrubbed camera read as a camera rather
       than as a flipbook being dragged. */
    const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 28 });

    /* The last stretch, after the footage has played out, pushes the whole
       plate toward the viewer: the camera keeps travelling after the gate,
       which is what carries you into the section below rather than stopping
       dead at the last frame. */
    const pushZ = useTransform(smooth, [SEQ_END, 1], [0, 220]);
    const pushScale = useTransform(smooth, [SEQ_END, 1], [1, 1.14]);

    return (
        <section id="top" ref={wrapRef} className={styles.wrap}>
            <div className={`${styles.sticky} ${scene.stage}`}>
                <motion.div
                    className={styles.plateWrap}
                    style={{ z: pushZ, scale: pushScale }}
                >
                    <SequenceCanvas
                        className={scene.plate}
                        imagesRef={imagesRef}
                        progress={smooth}
                        count={FRAME_COUNT}
                        /* Frames run out before the end of the track. The
                           remaining scroll is the push through the gate. */
                        seqEnd={SEQ_END}
                        fit="cover"
                        revision={revision}
                    />
                </motion.div>

                <span className={scene.air} aria-hidden="true" />
                {/* The scrim follows the beat that is showing: each one sits on
                    a different side of the frame, so a fixed wash would darken
                    the half the copy is not on. */}
                <BeatScrim progress={smooth} />

                {/* The footage is decorative; this carries the meaning for
                    anyone who cannot see it, and for crawlers. */}
                <h1 className={styles.sr}>
                    {site.name}. {site.role}. {site.tagline}
                </h1>

                {heroBeats.map((beat) => (
                    <Beat key={beat.title} beat={beat} progress={smooth} />
                ))}

                <Intro progress={smooth} />

                {!ready && (
                    <div className={styles.loader} role="status" aria-live="polite">
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

/* The wash under whichever beat is currently up. Three stacked gradients,
   each faded by its own beat's range, so the dark side of the frame tracks
   the copy across the section instead of sitting in one place. */
function BeatScrim({ progress }: { progress: ReturnType<typeof useSpring> }) {
    return (
        <>
            {heroBeats.map((beat) => (
                <ScrimFor key={beat.title} beat={beat} progress={progress} />
            ))}
            <ScrimFor
                beat={{ from: heroIntro.from, to: 1, align: "right" }}
                progress={progress}
            />
        </>
    );
}

function ScrimFor({
    beat,
    progress,
}: {
    beat: { from: number; to: number; align: HeroBeat["align"] };
    progress: ReturnType<typeof useSpring>;
}) {
    const opacity = useTransform(
        progress,
        [beat.from - 0.03, beat.from + 0.04, beat.to - 0.04, beat.to + 0.03],
        [0, 1, 1, 0],
    );
    const side =
        beat.align === "right" ? scene.scrimRight : beat.align === "center" ? scene.scrimCentre : "";
    return (
        <motion.span
            className={`${scene.scrim} ${side}`}
            style={{ opacity }}
            aria-hidden="true"
        />
    );
}

/* ------------------------------------------------------------------
   One beat. Fades in, holds, fades out across its own slice of the
   scroll, and drifts toward the viewer while it does, so it sits in
   the world rather than on a pane of glass in front of it.
   ------------------------------------------------------------------ */
function Beat({
    beat,
    progress,
}: {
    beat: HeroBeat;
    progress: ReturnType<typeof useSpring>;
}) {
    const { from, to } = beat;
    const opacity = useTransform(progress, [from, from + 0.04, to - 0.04, to], [0, 1, 1, 0]);
    const z = useTransform(progress, [from, to], [-90, 60]);

    /* Mounting is gated separately from opacity so a beat that is fully
       transparent is also not in the accessibility tree, and a screen reader
       does not read all three at once. */
    const [live, setLive] = useState(false);
    useMotionValueEvent(progress, "change", (v) => {
        const on = v >= from - 0.02 && v <= to + 0.02;
        setLive((was) => (was === on ? was : on));
    });

    return (
        <motion.div
            className={`${styles.beat} ${styles[beat.align]}`}
            style={{ opacity, z }}
            aria-hidden={!live}
        >
            <div className={styles.beatInner}>
                <h2 className={`${styles.beatTitle} ${scene.onWorld}`}>
                    <FlipFadeText text={beat.title} active={live} />
                </h2>
                <p className={`${styles.beatBody} ${scene.onWorldDim}`}>{beat.body}</p>
            </div>
        </motion.div>
    );
}

/* The arrival. Holds from its cue to the end of the track, so it is still
   on screen while the camera pushes through the gate. */
function Intro({ progress }: { progress: ReturnType<typeof useSpring> }) {
    const { from } = heroIntro;
    const opacity = useTransform(progress, [from, from + 0.06], [0, 1]);
    const z = useTransform(progress, [from, 1], [-120, 90]);

    return (
        <motion.div className={styles.intro} style={{ opacity, z }}>
            <div className={styles.introInner}>
                <p className={`${styles.introEyebrow} ${scene.onWorldDim}`}>
                    {heroIntro.eyebrow}
                </p>
                <p className={`${styles.introName} ${scene.onWorld}`}>{heroIntro.name}</p>
                <p className={`${styles.introBody} ${scene.onWorldDim}`}>{heroIntro.body}</p>
            </div>
        </motion.div>
    );
}
