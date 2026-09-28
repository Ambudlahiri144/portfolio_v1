"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
    motion,
    useMotionValueEvent,
    useScroll,
    useSpring,
    useTransform,
    type MotionValue,
} from "framer-motion";
import { useLenis } from "lenis/react";
import { useReducedMotion } from "@light/lib/useReducedMotion";
import BookCanvas from "./BookCanvas";
import BookStatic from "./BookStatic";
import { computeFit, place, type Fit } from "./fit";
import { spreads } from "./Spreads";
import { FADE, holds, manifest, readingPoint, rect, totalVh, type Hold } from "./timeline";
import { frameUrl, useBookFrames } from "./useBookFrames";
import styles from "./Book.module.css";

/* ==================================================================
   THE BOOK — the whole light-theme home page.

   A wrapper as tall as the timeline, holding a sticky full-viewport
   stage. Scrolling through the wrapper scrubs the footage on the canvas
   and fades each spread's HTML onto the pages as the book comes to rest.

   Reduced motion and portrait screens get BookStatic instead: the same
   spreads as ordinary paper sheets in document order. Portrait is a
   stand-in until there is 9:16 footage — a two-page spread fitted to a
   phone leaves text too small to read.
   ================================================================== */

const G = manifest.geometry;
const SRC_W = manifest.width;
const SRC_H = manifest.height;

/* The dock's band at the bottom of the stage, kept clear of the book. */
const DOCK_RESERVE = 88;

function subscribePortrait(cb: () => void) {
    const mq = window.matchMedia("(max-aspect-ratio: 1/1), (max-width: 760px)");
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
}
const getPortrait = () => window.matchMedia("(max-aspect-ratio: 1/1), (max-width: 760px)").matches;

export default function Book() {
    const reduced = useReducedMotion();
    const portrait = useSyncExternalStore(subscribePortrait, getPortrait, () => false);
    return reduced || portrait ? <BookStatic /> : <BookScroll />;
}

function BookScroll() {
    const wrapRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const [stage, setStage] = useState({ w: 0, h: 0 });

    const { scrollYProgress } = useScroll({
        target: wrapRef,
        offset: ["start start", "end end"],
    });
    /* The same spring as the dark theme's sequences: it gives the page its
       weight, and it rounds off the hand-off between a turn and a hold. */
    const progress = useSpring(scrollYProgress, { stiffness: 70, damping: 28, restDelta: 0.0001 });

    const { store, ready } = useBookFrames();

    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setStage((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const fit = stage.w
        ? computeFit(stage.w, stage.h, SRC_W, SRC_H, rect(G.book), DOCK_RESERVE)
        : null;

    return (
        <div ref={wrapRef} className={styles.wrap} style={{ height: `${totalVh + 100}vh` }}>
            {/* Every spread's resting point, so links can jump to it. Those
                with an anchor are the dock's targets. */}
            {holds.map((h) => (
                <span
                    key={h.spread}
                    id={h.anchor}
                    data-spread={h.spread}
                    className={styles.marker}
                    style={{ top: `${readingPoint(h) * totalVh}vh` }}
                    aria-hidden="true"
                />
            ))}

            <div ref={stageRef} className={styles.stage}>
                {/* The cover, as a real image, until the canvas has painted:
                    it is the page's largest element and should not wait for
                    script. */}
                {!ready && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        className={styles.poster}
                        src={frameUrl("open", 0, "lg")}
                        alt=""
                        aria-hidden="true"
                        fetchPriority="high"
                        style={fit ? posterStyle(fit) : undefined}
                    />
                )}

                <BookCanvas
                    store={store}
                    progress={progress}
                    fit={fit}
                    stage={stage}
                    className={styles.canvas}
                />

                {fit &&
                    holds.map((h, i) => (
                        <Spread
                            key={h.spread}
                            hold={h}
                            next={holds[i + 1]}
                            fit={fit}
                            progress={progress}
                        />
                    ))}
            </div>
        </div>
    );
}

function posterStyle(fit: Fit): CSSProperties {
    return { left: fit.x, top: fit.y, width: fit.w, height: fit.h, objectFit: "fill" };
}

/* ------------------------------------------------------------------
   One spread's content, laid onto the pages.
   ------------------------------------------------------------------ */

function Spread({
    hold,
    next,
    fit,
    progress,
}: {
    hold: Hold;
    next?: Hold;
    fit: Fit;
    progress: MotionValue<number>;
}) {
    const slots = spreads[hold.spread];
    const first = hold.from === 0;
    const last = hold.to >= 0.9999;
    const span = hold.to - hold.from;
    const inAt = hold.from + span * FADE;
    const outAt = hold.to - span * FADE;

    const opacity = useTransform(
        progress,
        [hold.from, inAt, outAt, hold.to],
        [first ? 1 : 0, 1, 1, last ? 1 : 0],
    );

    /* Past halfway into view: interactive, and the ink settles. Below it the
       spread is inert, so nothing invisible can be tabbed to or clicked. */
    const visible = (p: number) =>
        (first || p >= hold.from + span * FADE * 0.5) && (last || p <= hold.to - span * FADE * 0.5);
    const [active, setActive] = useState(() => visible(progress.get()));
    useMotionValueEvent(progress, "change", (p) => {
        const v = visible(p);
        if (v !== active) setActive(v);
    });

    const page = (r: readonly number[]): CSSProperties => {
        const box = place(fit, rect(r));
        return {
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            ["--pw" as string]: `${box.width}px`,
        };
    };

    /* The tablecloth beside the closed book: from the stage's left gutter to
       just short of the book. */
    const book = place(fit, rect(G.coverBook));
    const table: CSSProperties = {
        left: 0,
        top: 0,
        width: Math.max(0, book.left),
        bottom: DOCK_RESERVE,
        ["--pw" as string]: `${book.width}px`,
    };

    return (
        <motion.div
            className={styles.spread}
            style={{ opacity }}
            data-active={active || undefined}
            inert={!active}
            aria-hidden={!active}
        >
            {slots.label && (
                <div className={styles.labelSlot} style={page(G.coverLabel)}>
                    {slots.label}
                </div>
            )}
            {slots.table && (
                <div className={styles.tableSlot} style={table}>
                    {slots.table}
                </div>
            )}
            {slots.left && (
                <div className={`${styles.page} ${styles.left}`} style={page(G.pages.left)}>
                    {slots.left}
                </div>
            )}
            {slots.right && (
                <div className={`${styles.page} ${styles.right}`} style={page(G.pages.right)}>
                    {slots.right}
                    {next && next.spread !== "closed" && <DogEar to={next.spread} />}
                </div>
            )}
        </motion.div>
    );
}

/* The corner of the right-hand page lifts under the pointer; pressing it
   turns to the next spread. The book can be read without scrolling. */
function DogEar({ to }: { to: string }) {
    const lenis = useLenis();
    return (
        <button
            type="button"
            className={styles.dogEar}
            aria-label="Turn the page"
            onClick={() => {
                const el = document.querySelector<HTMLElement>(`[data-spread="${to}"]`);
                if (el && lenis) lenis.scrollTo(el, { duration: 2 });
                else el?.scrollIntoView();
            }}
        >
            <span aria-hidden="true" />
        </button>
    );
}
