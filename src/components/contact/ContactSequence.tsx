"use client";

import { useRef, useState } from "react";
import {
    useScroll,
    useSpring,
    useTransform,
    useMotionValueEvent,
    motion,
} from "framer-motion";
import FlipFadeText from "../hero/FlipFadeText";
import SequenceCanvas from "../sequence/SequenceCanvas";
import { useFrameSequence } from "../sequence/useFrameSequence";
import ContactForm from "./ContactForm";
import {
    contactBeats,
    contactForm,
    contactSequence,
    type ContactBeat,
} from "@/lib/site";
import { useInView } from "@/lib/useinview";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useTheme, type Theme } from "@/lib/useTheme";
import scene from "../scene/scene.module.css";
import styles from "./ContactSequence.module.css";

const {
    count: FRAME_COUNT,
    seqEnd: SEQ_END,
} = contactSequence;

/* One set per world, rendered by scripts/scene.mjs. Light climbs the last
   steps to a summit shrine in the afternoon; dark approaches an old shrine
   wedged between towers in the rain. Both arrive and come to rest facing it,
   so the toggle changes where you are and not what the camera is doing. */
function framePath(i: number, small: boolean, theme: Theme) {
    const n = String(i + 1).padStart(3, "0");
    return `/scene/contact/${theme}/${small ? "sm/" : ""}frame-${n}.webp`;
}

/* Same split as SequenceHero, for the same reason: hooks cannot be called
   conditionally, so a single component would have to run useScroll even on the
   reduced-motion path — where its target ref is never attached and Motion
   throws "Target ref is defined but not hydrated". */
export default function ContactSequence() {
    const reduced = useReducedMotion();
    return reduced ? <StaticContact /> : <ScrollContact />;
}

/* ------------------------------------------------------------------
   Reduced motion: the last frame, and the beats as ordinary text.
   No 480vh, no canvas, no 81-image download.
   ------------------------------------------------------------------ */
function StaticContact() {
    const theme = useTheme();
    return (
        <section id="contact" className={styles.static}>
            <h2 className={styles.sr}>Contact</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={framePath(FRAME_COUNT - 1, false, theme)}
                alt=""
                className={styles.staticImage}
            />
            {contactBeats.length > 0 && (
                <div className={styles.staticCopy}>
                    {contactBeats.map((beat) => (
                        <div key={beat.title} className={styles.staticBeat}>
                            <h3 className={styles.staticTitle}>{beat.title}</h3>
                            {beat.body && (
                                <p className={styles.staticBody}>{beat.body}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {/* The form is the point of the section, so it is never gated on
                motion — it just sits in normal flow here instead of fading up
                over a held frame. */}
            <div className={styles.staticForm}>
                <ContactForm />
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
function ScrollContact() {
    const theme = useTheme();
    const wrapRef = useRef<HTMLElement>(null);

    /* Hold the download until the section is nearly on screen.

       The hero blocks behind a full-screen loader, which is right for something
       above the fold and wrong for a section several viewports down: it would
       put this set in flight at page load, competing with the hero's own frames
       for bandwidth and mostly wasted on anyone who never scrolls this far.

       150% of a viewport of lead time is enough for the set to arrive before
       the first frame is needed on a normal connection, and the paint loop
       holds the previous frame if a fast scroller outruns it. */
    const { ref: nearRef, inView: near } = useInView<HTMLDivElement>({
        threshold: 0,
        rootMargin: "150% 0px",
        once: true,
    });

    const { imagesRef, progress, ready, revision } = useFrameSequence({
        count: FRAME_COUNT,
        path: framePath,
        theme,
        enabled: near,
    });

    const { scrollYProgress } = useScroll({
        target: wrapRef,
        offset: ["start start", "end end"],
    });

    /* Matched to the hero so the two sequences scrub at the same weight. */
    const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 28 });

    return (
        <section
            id="contact"
            ref={wrapRef}
            className={styles.wrap}
            /* One source of truth for the footage's shape — the CSS band and the
               encoded frames are the same number. */
            style={{ "--aspect": contactSequence.aspect } as React.CSSProperties}
        >
            {/* The preload trigger. A zero-height marker at the top of the
                section rather than the section itself: the wrapper is 480vh
                tall, so it is already intersecting long before the footage is
                anywhere near being needed. */}
            <div ref={nearRef} className={styles.trigger} aria-hidden="true" />

            {/* The sticky area is the full viewport, and the footage is a band
                centred inside it — not the other way round.

                The band alone was enough while this section was only a canvas,
                but the form has to live in here too, and on a phone the band is
                about 219px tall. A card with a heading, three fields and a
                button does not go in 219px. Giving the sticky element the whole
                viewport costs nothing here: this is the last section on the
                page, so there is no hand-off below it where leftover height
                could show as a dead strip. */}
            <div className={`${styles.sticky} ${scene.stage}`}>
                <div className={styles.band}>
                    {/* cover, not contain. The band is already the footage's
                        aspect, so on any normal viewport this crops nothing; it
                        only earns its keep on a short, wide window where the
                        band hits the 100svh cap and would otherwise letterbox. */}
                    <SequenceCanvas
                        className={scene.plate}
                        imagesRef={imagesRef}
                        progress={smooth}
                        count={FRAME_COUNT}
                        seqEnd={SEQ_END}
                        fit="cover"
                        revision={revision}
                    />

                    {/* Fades the panel's edges into the page. The first sixty
                        frames are lit right into the corners, so unlike the hero
                        there is no background colour that makes the boundary
                        disappear on its own. */}
                    <span className={scene.air} aria-hidden="true" />
                    <span className={`${scene.scrim} ${scene.scrimCentre}`} aria-hidden="true" />
                </div>

                {/* The canvas is decorative, so without this the section is a
                    landmark with no heading. */}
                <h2 className={styles.sr}>Contact</h2>

                {contactBeats.map((beat) => (
                    <Beat key={beat.title} beat={beat} progress={smooth} />
                ))}

                <FormLayer progress={smooth} />

                {/* Non-blocking, unlike the hero's full-screen loader — this
                    sits in the corner and lets the footage play underneath as
                    it fills. Gone the moment the set is complete. */}
                {near && !ready && (
                    <div className={styles.loading} role="status" aria-live="polite">
                        <span className={styles.loadingBar} aria-hidden="true">
                            <span
                                className={styles.loadingFill}
                                style={{ transform: `scaleX(${progress})` }}
                            />
                        </span>
                        <span className={styles.loadingText}>
                            {Math.round(progress * 100)}%
                        </span>
                    </div>
                )}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */

/* Same shape as the hero's Beat. Kept local rather than shared: the hero's
   version reads from HeroBeat and carries hero-specific type styling, and
   folding both into one component would mean a props bag wider than the two
   copies put together. */
function Beat({
    beat,
    progress,
}: {
    beat: ContactBeat;
    progress: ReturnType<typeof useSpring>;
}) {
    const { from, to } = beat;
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

    /* A boolean, not a per-frame value — the flip is a discrete entrance, so it
       only needs to know when the beat crosses into its range. */
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
                <h3 className={styles.beatTitle}>
                    <FlipFadeText text={beat.title} active={active} />
                </h3>
                {beat.body && <p className={styles.beatBody}>{beat.body}</p>}
            </div>
        </motion.div>
    );
}

/* The closing form.

   A plain fade and a short lift, not the letter flip the beats use — the beats
   are display type making a single statement each, this is a block of controls
   someone has to read and fill in. Flipping a form's labels in one at a time
   would be motion for its own sake. */
function FormLayer({ progress }: { progress: ReturnType<typeof useSpring> }) {
    const { from } = contactForm;
    const opacity = useTransform(progress, [from, from + 0.06], [0, 1]);
    const y = useTransform(progress, [from, from + 0.06], [28, 0]);

    /* Gates pointer events and tab focus together.

       Without this the inputs are still in the tab order and still clickable
       while the card is fully transparent — so a keyboard user tabbing through
       the page lands inside an invisible form, and a click meant for the page
       behind it hits a text field instead. */
    const [visible, setVisible] = useState(false);
    useMotionValueEvent(progress, "change", (v) => {
        const next = v >= from + 0.03;
        setVisible((prev) => (prev === next ? prev : next));
    });

    return (
        <motion.div
            className={styles.formLayer}
            style={{ opacity, y }}
            /* aria-hidden as well as inert: inert removes it from the tab order
               and the accessibility tree in browsers that support it, and
               aria-hidden covers the rest. */
            inert={!visible}
            aria-hidden={!visible}
        >
            <ContactForm />
        </motion.div>
    );
}
