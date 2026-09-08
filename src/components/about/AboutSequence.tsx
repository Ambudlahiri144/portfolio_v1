"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import {
    useScroll,
    useSpring,
    useTransform,
    useMotionValueEvent,
    motion,
} from "framer-motion";
import { useLenis } from "lenis/react";
import FlipFadeText from "../hero/FlipFadeText";
import SequenceCanvas from "../sequence/SequenceCanvas";
import { useFrameSequence } from "../sequence/useFrameSequence";
import {
    aboutBeats,
    aboutOutro,
    aboutSequence,
    site,
    type AboutBeat,
} from "@/lib/site";
import { useReducedMotion } from "@/lib/useReducedMotion";
import styles from "./AboutSequence.module.css";

/* ==================================================================
   ABOUT — scrollytelling sequence

   This footage used to open the page. It is the About section now: the
   same three beats scrubbed across the same 700vh, but where it ended
   by announcing the name it ends on what About actually has to say,
   and on the two links that are the only route out of this page other
   than the dock.

   The name moved up to the video hero, where an introduction belongs.
   Saying it in both places was the reason to move this at all.
   ================================================================== */

const {
    count: FRAME_COUNT,
    background: BG,
    seqEnd: SEQ_END,
    slideTo: SLIDE_TO,
    slideEnd: SLIDE_END,
} = aboutSequence;

/* Still /hero-motion — see the note on aboutSequence in site.ts. The directory
   kept its name because renaming 290 files changes nothing a visitor sees. */
function framePath(i: number, small: boolean) {
    const n = String(i + 1).padStart(3, "0");
    return small ? `/hero-motion/sm/frame-${n}.webp` : `/hero-motion/frame-${n}.webp`;
}

/* ------------------------------------------------------------------
   "Has the page finished loading yet?"

   This is the gate on the 145-frame download, and it is deliberately
   NOT a viewport gate.

   The contact sequence uses useInView with a 150% rootMargin, which
   works there because it sits several viewports down the page. It
   cannot work here. This section begins exactly one viewport below the
   top, so a marker at the top of its wrapper sits on the seam with the
   hero — at scroll position zero it is already level with the bottom of
   the viewport, and any positive rootMargin intersects it immediately.
   Measured: all 145 frames were in flight at page load with the
   observer in place, which is the exact thing it was added to prevent.

   The real requirement was never "load late", it was "do not race the
   hero video for bandwidth". The load event says precisely that: a
   media element delays it until it has its first frame data, so by the
   time this flips the video is playable and the frames can have the
   pipe. It is roughly one viewport of scrolling before they are needed.

   useSyncExternalStore rather than useState + useEffect, matching
   useReducedMotion: it resolves during the first client render instead
   of returning a placeholder and re-rendering a tick later, and it
   avoids a setState in an effect body.
   ------------------------------------------------------------------ */
function usePageLoaded() {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (document.readyState === "complete") {
            /* The load event has already been and gone, which is the common
               case: hydration usually happens after it.

               A timeout rather than calling setLoaded here in the effect body.
               A synchronous setState in an effect is a cascading render and
               the lint rule this project runs rejects it; deferring by a tick
               is both cheaper and legal.

               This branch is not optional. An earlier version of this gate
               used useSyncExternalStore and simply attached no listener when
               the page was already complete — the store then sat on the false
               it read during hydration, nothing ever asked it again, and the
               145 frames never downloaded at all. Verified in the browser. */
            const t = window.setTimeout(() => setLoaded(true), 0);
            return () => window.clearTimeout(t);
        }

        const onLoad = () => setLoaded(true);
        window.addEventListener("load", onLoad, { once: true });
        return () => window.removeEventListener("load", onLoad);
    }, []);

    return loaded;
}

/* Split into two components on purpose.

   Hooks cannot be called conditionally, so a single component would have to run
   useScroll even when rendering the reduced-motion branch — where its target ref
   is never attached to anything, and Motion throws "Target ref is defined but
   not hydrated". The same applies to the 145-frame preload: it has no business
   running for a fallback that shows one still image. Choosing the component
   rather than branching inside one keeps each path honest. */
export default function AboutSequence() {
    const reduced = useReducedMotion();
    return reduced ? <StaticAbout /> : <ScrollAbout />;
}

/* ------------------------------------------------------------------
   Reduced motion: one still, all beats as ordinary stacked text, and
   the closing block in normal flow beneath them. No 700vh, no canvas,
   no frame loop, no 145-image download.
   ------------------------------------------------------------------ */
function StaticAbout() {
    return (
        <section id="about" className={styles.static}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={framePath(FRAME_COUNT - 1, false)}
                alt=""
                aria-hidden="true"
                className={styles.staticImage}
            />
            <div className={styles.staticCopy}>
                {aboutBeats.map((beat) => (
                    <div key={beat.title} className={styles.staticBeat}>
                        <h3 className={styles.staticTitle}>{beat.title}</h3>
                        <p className={styles.staticBody}>{beat.body}</p>
                    </div>
                ))}

                {/* The section's real heading and its navigation. Never gated on
                    motion — losing the only links to /experience and the work
                    would be a functional regression, not a quieter page. */}
                <div className={styles.staticOutro}>
                    <p className={styles.outroEyebrow}>{aboutOutro.eyebrow}</p>
                    <h2 className={styles.staticHeading}>{aboutOutro.heading}</h2>
                    {aboutOutro.body.map((para) => (
                        <p key={para} className={styles.outroBody}>
                            {para}
                        </p>
                    ))}
                    <Actions />
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
function ScrollAbout() {
    const wrapRef = useRef<HTMLElement>(null);

    /* ---- preload ---------------------------------------------------- */
    /* Gated, unlike the version that opened the page.

       This was above the fold once, which is what justified starting all 145
       frames immediately. It is the second section now, and roughly 6.7 MB of
       WebP racing the hero's video at page load helps neither. See the note on
       subscribeToLoad above for why the gate is the load event and not an
       IntersectionObserver — the short version is that this section starts one
       viewport down, so a viewport gate fires instantly and buys nothing.

       The set has about a viewport of scrolling to arrive in, and the paint
       loop holds the previous frame if a fast scroller outruns it. */
    const afterLoad = usePageLoaded();

    const { imagesRef, progress, ready } = useFrameSequence({
        count: FRAME_COUNT,
        path: framePath,
        enabled: afterLoad,
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
        /* id="about" — the dock's About link, the footer's, and the back link
           on /experience all point here. */
        <section
            id="about"
            ref={wrapRef}
            className={styles.wrap}
            /* One source of truth for the footage's shape — the CSS band and the
               encoded frames are the same number. */
            style={{ "--aspect": aboutSequence.aspect } as React.CSSProperties}
        >
            <div className={styles.sticky}>
                {/* The frame is pushed left once the sequence has played out,
                    clearing the right of the stage for the closing block. He is
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
                           scroll is the slide and the closing block, which hold
                           on the final frame. */
                        seqEnd={SEQ_END}
                        background={BG}
                        fit="contain"
                        revision={ready}
                    />
                </motion.div>

                {aboutBeats.map((beat) => (
                    <Beat key={beat.title} beat={beat} progress={smooth} />
                ))}

                <Outro progress={smooth} />

                <ScrollCue progress={smooth} />

                {/* Non-blocking, unlike the full-screen loader this section had
                    while it was the hero. A blocking black panel is right for
                    something above the fold that has nothing else to show; on a
                    deferred section it would flash over the page as you scroll
                    in. This sits in the corner and lets the footage play
                    underneath as it fills. */}
                {afterLoad && !ready && (
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

function Beat({
    beat,
    progress,
}: {
    beat: AboutBeat;
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
                    as noise and actively hurts reading it.

                    An <h3>, not an <h2>: the section's one <h2> is the About
                    heading in the closing block, and three display lines that
                    happen to be large are not three peers of it. */}
                <h3 className={styles.beatTitle}>
                    <FlipFadeText text={beat.title} active={active} />
                </h3>
                <p className={styles.beatBody}>{beat.body}</p>
            </div>
        </motion.div>
    );
}

/* The closing block — the beat the footage used to carry as an identity
   reveal, and before that as baked-in pixels. Same type treatment as the beats
   above, but it holds to the end of the scroll instead of fading out, and it
   contains two real links, which nothing else in this overlay ever has. */
function Outro({ progress }: { progress: ReturnType<typeof useSpring> }) {
    const { from } = aboutOutro;
    const opacity = useTransform(progress, [from, from + 0.06], [0, 1]);
    const y = useTransform(progress, [from, from + 0.06], [24, 0]);

    /* Holds once reached — this is the closing block, so it never flips away. */
    const [active, setActive] = useState(false);

    /* Gates pointer events and tab focus together.

       Without this the two links are still in the tab order and still clickable
       while the block is fully transparent — so a keyboard user tabbing down the
       page lands on invisible buttons floating over the footage, and a click
       meant for the page behind hits a link instead. Slightly later than
       `active` so nothing is interactive while it is still fading up. */
    const [visible, setVisible] = useState(false);

    useMotionValueEvent(progress, "change", (v) => {
        const on = v >= from;
        setActive((prev) => (prev === on ? prev : on));
        const touchable = v >= from + 0.03;
        setVisible((prev) => (prev === touchable ? prev : touchable));
    });

    return (
        <motion.div
            className={styles.outro}
            style={{ opacity, y }}
            /* inert removes it from the tab order and the accessibility tree in
               browsers that support it; aria-hidden covers the rest. */
            inert={!visible}
            aria-hidden={!visible}
        >
            <div className={styles.outroInner}>
                <p className={styles.outroEyebrow}>{aboutOutro.eyebrow}</p>

                {/* The section's real <h2>. It is in the DOM the whole time and
                    only its opacity is animated, so the document outline is
                    complete from first paint regardless of scroll position. */}
                <h2 className={styles.outroHeading}>
                    <FlipFadeText
                        text={aboutOutro.heading}
                        active={active}
                        /* Slower and wider apart than the beats: this is the
                           payoff line, and it has the stage to itself. */
                        letterDuration={0.7}
                        staggerDelay={0.07}
                    />
                </h2>

                {aboutOutro.body.map((para) => (
                    <p key={para} className={styles.outroBody}>
                        {para}
                    </p>
                ))}

                <Actions />
            </div>
        </motion.div>
    );
}

/* Shared by both branches so the two cannot drift. These are the section's
   navigation — the only link to /experience on the landing page, and the only
   in-page link to the work that is not the dock. */
function Actions() {
    /* Undefined under reduced motion, where Lenis is never constructed. The
       handler early-returns and the browser takes the anchor. */
    const lenis = useLenis();

    /* In-page hashes go through Lenis so the motion matches the dock and the
       footer. A real route (/experience) has no hash, so it falls straight
       through to Link untouched. */
    const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
        const id = href.split("#")[1];
        if (!id || !lenis) return;
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0 });
        window.history.replaceState(null, "", href);
    };

    return (
        <div className={styles.outroActions}>
            {aboutOutro.actions.map((action) => (
                <Link
                    key={action.id}
                    href={action.href}
                    className={
                        action.kind === "solid" ? styles.btnSolid : styles.btnGhost
                    }
                    onClick={(e) => go(e, action.href)}
                >
                    {action.label}
                    {action.kind === "solid" && (
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
                    )}
                </Link>
            ))}
        </div>
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
