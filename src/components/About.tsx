"use client";

import type { CSSProperties } from "react";
import { useRef } from "react";
import { useScroll, useSpring } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { about, aboutSequence } from "@/lib/site";
import { useInView } from "@/lib/useinview";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFrameSequence } from "./sequence/useFrameSequence";
import SequenceCanvas from "./sequence/SequenceCanvas";
import { useTheme, type Theme } from "@/lib/useTheme";
import scene from "./scene/scene.module.css";
import styles from "./About.module.css";

/* ==================================================================
   ABOUT

   One panel of the screen, seen square on, with you painted on it.

   This section used to hold a single still portrait while the hero
   carried the scrubbed avatar. They have swapped, and the reason is
   that a byōbu carries a painting across all its panels while a person
   turning to camera is a portrait. The hero is the screen; this is
   where you actually appear on it.

   MOTIVATION, in one sentence: the panel is the one place in the site
   that holds still long enough to be looked at, so the figure turns to
   face the reader as they arrive at the words about him.

   THE ROOM IS THE BACKDROP. Light is a dojo with morning sun through
   shoji; dark is a small Tokyo apartment with the rainy city through the
   glass. One still each, pushed slowly on the z axis as the section
   passes, so the room has depth without needing a camera move rendered
   into it.

   You stand in front of that, keyed, so the room shows around you. The
   avatar itself is theme-neutral: it is a print of a person, and a
   person does not acquire weather.
   ================================================================== */

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

const FRAME_COUNT = aboutSequence.count;

function framePath(i: number, _small: boolean, theme: Theme) {
    const n = String(i + 1).padStart(3, "0");
    /* No small set. He is a figure in a portrait box, never full-bleed, so
       even on a phone the large one is barely 900px of actual coverage. */
    return `/scene/avatar/${theme}/frame-${n}.webp`;
}

export default function About() {
    /* Split on the branch, not inside it: `useScroll` needs a mounted target,
       and the static branch has no scroll track at all to measure. */
    return useReducedMotion() ? <StaticAbout /> : <ScrollAbout />;
}

/* ------------------------------------------------------------------ */

function Body({ visible }: { visible: boolean }) {
    return (
        <div className={styles.copy} data-visible={visible || undefined}>
            <p className={styles.eyebrow} style={delay(0)}>
                <span className={styles.eyebrowRule} />
                {about.eyebrow}
            </p>

            <h2 className={styles.heading} style={delay(0.08)}>
                {about.heading}
            </h2>

            {about.body.map((para, i) => (
                <p key={i} className={styles.para} style={delay(0.18 + i * 0.08)}>
                    {para}
                </p>
            ))}

            <div className={styles.actions} style={delay(0.36)}>
                <Link href="/experience" className={styles.btnSolid}>
                    Explore more
                    <svg
                        className={styles.arrow}
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M3.5 8h9M8.8 4.3 12.5 8l-3.7 3.7" />
                    </svg>
                </Link>

                <a href="#projects" className={styles.btnGhost}>
                    My Contributions
                </a>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------
   Reduced motion: the last frame, held. No track, no preload of 145
   images, no canvas. The composition is identical; only the turn is
   missing, and the turn is the thing that was asked to be removed.
   ------------------------------------------------------------------ */
function StaticAbout() {
    const { ref, inView } = useInView<HTMLElement>();
    const theme = useTheme();
    return (
        <section
            id="about"
            ref={ref}
            className={`${styles.about} ${scene.stage}`}
            data-visible={inView || undefined}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`/scene/backdrop/about-${theme}.webp`}
                alt=""
                aria-hidden="true"
                className={`${scene.plate} ${styles.room}`}
            />
            <span className={scene.air} aria-hidden="true" />
            <span className={scene.scrim} aria-hidden="true" />
            <div className={`${styles.inner} ${scene.near}`}>
                <Body visible={inView} />
                <div className={styles.portraitCol} style={delay(0.14)}>
                    <div className={styles.portrait}>
                        <div className={styles.frame}>
                            <Image
                                src={about.photo(theme)}
                                alt={about.photoAlt}
                                fill
                                sizes="(max-width: 48rem) 62vw, 340px"
                                className={styles.photo}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */

function ScrollAbout() {
    const wrapRef = useRef<HTMLElement>(null);

    /* Gated on approach rather than started at page load. About is the second
       section, so its 145 frames would otherwise race the hero's for bandwidth
       during the one moment the hero is being watched. */
    const { ref: nearRef, inView: near } = useInView<HTMLDivElement>({
        rootMargin: "120% 0px",
        once: true,
    });
    const { ref: seenRef, inView: seen } = useInView<HTMLDivElement>({ threshold: 0.2 });

    const theme = useTheme();
    const { imagesRef, revision } = useFrameSequence({
        count: FRAME_COUNT,
        path: framePath,
        theme,
        enabled: near,
    });

    /* `start end` to `end start`: the whole time the section is anywhere in
       view. The figure has finished turning by the time the section is
       centred, which is when the copy beside him is being read. */
    const { scrollYProgress } = useScroll({
        target: wrapRef,
        offset: ["start end", "end start"],
    });
    const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 28 });

    return (
        <section id="about" ref={wrapRef} className={`${styles.about} ${scene.stage}`}>
            <div ref={nearRef} className={styles.trigger} aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`/scene/backdrop/about-${theme}.webp`}
                alt=""
                aria-hidden="true"
                className={`${scene.plate} ${scene.far} ${styles.room}`}
            />
            <span className={scene.air} aria-hidden="true" />
            <span className={scene.scrim} aria-hidden="true" />
            <div className={`${styles.inner} ${scene.near}`} ref={seenRef} data-visible={seen || undefined}>
                <Body visible={seen} />

                <div className={styles.portraitCol} style={delay(0.14)}>
                    <div className={styles.portrait}>
                        <div className={styles.frame}>
                            {/* Transparent, because the print is keyed: he stands
                                on the leaf with nothing behind him. An opaque
                                context would fill the panel with the page colour
                                and hide the gold, which is exactly the bug the
                                hero had. */}
                            <SequenceCanvas
                                className={styles.canvas}
                                imagesRef={imagesRef}
                                progress={smooth}
                                count={FRAME_COUNT}
                                seqEnd={aboutSequence.seqEnd}
                                fit="contain"
                                transparent
                                revision={revision}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* The canvas is decorative; this carries the portrait for anyone
                who cannot see it. */}
            <p className={styles.sr}>{about.photoAlt}</p>
        </section>
    );
}
