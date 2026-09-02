"use client";

import { useEffect, useRef, useState } from "react";
import {
    useScroll,
    useSpring,
    useTransform,
    useMotionValueEvent,
    motion,
} from "framer-motion";
import FlipFadeText from "./FlipFadeText";
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

/* How many frames are in flight at once while preloading.

   Firing all 205 at once is fine over HTTP/2 but stampedes the dev server on
   HTTP/1.1, and it makes the progress bar jump rather than fill. A modest
   window keeps both honest. */
const CONCURRENCY = 12;

function framePath(i: number, small: boolean) {
    const n = String(i + 1).padStart(3, "0");
    return small ? `/hero-motion/sm/frame-${n}.webp` : `/hero-motion/frame-${n}.webp`;
}

/* The small set is picked on physical pixels, not CSS width — a 390pt phone at
   3x is asking for more detail than a 900px laptop window. The threshold sits
   just above a typical phone's device width so handsets take the 1.57 MB set
   rather than the 4.27 MB one. */
function wantsSmallSet() {
    if (typeof window === "undefined") return false;
    return window.innerWidth * (window.devicePixelRatio || 1) < 1400;
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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imagesRef = useRef<HTMLImageElement[]>([]);
    const drawnRef = useRef(-1);

    const [progress, setProgress] = useState(0);
    const [ready, setReady] = useState(false);

    /* ---- preload ---------------------------------------------------- */
    useEffect(() => {
        let cancelled = false;
        const small = wantsSmallSet();
        const images: HTMLImageElement[] = new Array(FRAME_COUNT);
        imagesRef.current = images;

        let loaded = 0;
        let next = 0;

        const startOne = (): Promise<void> => {
            const i = next++;
            if (i >= FRAME_COUNT) return Promise.resolve();
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.decoding = "async";
                /* Resolve on error too. One missing frame should degrade to a
                   held previous frame, never a permanently stuck loader. */
                const done = () => {
                    loaded += 1;
                    if (!cancelled) setProgress(loaded / FRAME_COUNT);
                    resolve();
                };
                img.onload = done;
                img.onerror = done;
                img.src = framePath(i, small);
                images[i] = img;
            }).then(() => (next < FRAME_COUNT ? startOne() : undefined));
        };

        Promise.all(Array.from({ length: CONCURRENCY }, startOne)).then(() => {
            if (!cancelled) setReady(true);
        });

        return () => {
            cancelled = true;
            /* Drop the decoded bitmaps rather than waiting for GC to notice —
               205 frames is a lot of memory to leave hanging on a route change. */
            for (const img of images) {
                if (img) {
                    img.onload = null;
                    img.onerror = null;
                    img.src = "";
                }
            }
            imagesRef.current = [];
        };
    }, []);

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

    /* ---- draw ------------------------------------------------------- */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        let raf = 0;
        let cw = 0;
        let ch = 0;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            cw = Math.round(canvas.clientWidth * dpr);
            ch = Math.round(canvas.clientHeight * dpr);
            if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw;
                canvas.height = ch;

                /* Assigning width or height resets the whole 2D context state,
                   so the smoothing hint has to be re-applied every time rather
                   than once at setup. It defaults to "low" — a cheap filter that
                   is very visible on a frame scaled to fill a hero. */
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                /* The buffer was just reallocated and cleared, so whatever was
                   on screen is gone — force the next tick to repaint. */
                drawnRef.current = -1;
            }
        };

        const paint = (index: number) => {
            /* Bail rather than "successfully" drawing nothing.

               The canvas is sized by CSS from the viewport width, so on the
               first effect run it can still measure 0. Painting at 0x0 returns
               true, marks the frame as drawn, and the loop then skips every
               subsequent frame — a permanently black canvas with no error. */
            if (!cw || !ch) return false;

            const img = imagesRef.current[index];
            if (!img || !img.complete || !img.naturalWidth) return false;

            ctx.fillStyle = BG;
            ctx.fillRect(0, 0, cw, ch);

            /* contain, never cover. The sequence is 2.29:1 and the last frames
               carry the title card off to the right — a cover crop on a phone
               would slice that card clean off. */
            const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
            const w = img.naturalWidth * scale;
            const h = img.naturalHeight * scale;
            ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
            return true;
        };

        const tick = () => {
            raf = requestAnimationFrame(tick);
            /* Frames run out at SEQ_END, not at 1 — the remaining scroll is the
               slide and the introduction, which hold on the final frame. */
            const t = Math.min(1, smooth.get() / SEQ_END);
            /* Clamped: at t exactly 1 the raw index lands one past the end and
               the last frame flickers to nothing. */
            const i = Math.min(
                FRAME_COUNT - 1,
                Math.max(0, Math.floor(t * FRAME_COUNT)),
            );
            if (i === drawnRef.current) return;
            if (paint(i)) drawnRef.current = i;
        };

        resize();
        raf = requestAnimationFrame(tick);

        /* Observing the canvas rather than the window. Its height comes from a
           CSS calc on the viewport width, so it can settle after the effect has
           already run — and a window resize listener alone never hears about
           that first 0 -> real transition. */
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
        };
    }, [smooth, ready]);

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
                    <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
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
