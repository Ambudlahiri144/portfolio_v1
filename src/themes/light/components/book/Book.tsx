"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
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
import { BookNavContext, type BookNav } from "./BookNav";
import DogEar from "./DogEar";
import { SpreadActiveContext } from "./SpreadActive";
import PopupLayer from "./popup/PopupLayer";
import PenLayer from "./pen/PenLayer";
import CatLayer from "./cat/CatLayer";
import EndLayer from "./end/EndLayer";
import { cat } from "@light/lib/site";
import DaylightGrade from "./DaylightGrade";
import Dust from "./Dust";
import Ribbon from "./Ribbon";
import LampChain from "./LampChain";
import BookStatic from "./BookStatic";
import { computeFit, place, type Fit } from "./fit";
import { spreads } from "./Spreads";
import { FADE, endGeometry, holds, manifest, readingPoint, rect, spreadShowing, totalVh, type Hold } from "./timeline";
import { frameUrl, useBookFrames } from "./useBookFrames";
import styles from "./Book.module.css";

/* ==================================================================
   THE BOOK — the whole light-theme home page.

   A wrapper as tall as the timeline, holding a sticky full-viewport
   stage. Scrolling through the wrapper scrubs the footage on the canvas,
   and as the book comes to rest a fountain pen writes each spread's text
   onto its pages (pen/); photographs and objects fade on.

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
    const lenis = useLenis();

    /* Move the page to a point in the book. Through Lenis when it is there,
       so animated jumps ease like every other in-page move. */
    const nav = useMemo<BookNav>(
        () => ({
            progress,
            scrollToProgress: (p, opts = {}) => {
                const wrap = wrapRef.current;
                if (!wrap) return;
                const top = wrap.getBoundingClientRect().top + window.scrollY;
                const range = wrap.offsetHeight - window.innerHeight;
                const y = top + Math.min(1, Math.max(0, p)) * range;
                if (lenis) {
                    lenis.scrollTo(y, opts.immediate ? { immediate: true, force: true } : { duration: opts.duration ?? 2 });
                } else {
                    window.scrollTo({ top: y, behavior: opts.immediate ? "instant" : "smooth" });
                }
            },
        }),
        [progress, lenis],
    );

    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        let stageWidth = 1;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            stageWidth = Math.max(1, width);
            setStage((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
        });
        ro.observe(el);

        /* Where the pointer is across the stage, 0..1, as --px: the gold
           foil's highlight follows it. Written straight to the style, never
           through React, once a frame, and only onto the foil itself
           ([data-foil]). Set on the stage it was inherited by every element
           of the book, so each pointer move restyled all of them, and a
           listener that then measured something (Dust) paid for that
           restyle synchronously: 20-30 ms a move over the contact page. */
        let raf = 0;
        let x = 0.5;
        const paint = () => {
            raf = 0;
            const v = x.toFixed(3);
            el.querySelectorAll<HTMLElement>("[data-foil]").forEach((f) => f.style.setProperty("--px", v));
        };
        const onMove = (e: PointerEvent) => {
            /* The stage spans the viewport from its left edge; its width
               comes from the observer, as reading it here would force
               layout. */
            x = e.clientX / stageWidth;
            if (!raf) raf = requestAnimationFrame(paint);
        };
        el.addEventListener("pointermove", onMove, { passive: true });
        return () => {
            ro.disconnect();
            cancelAnimationFrame(raf);
            el.removeEventListener("pointermove", onMove);
        };
    }, []);

    const fit = stage.w
        ? computeFit(stage.w, stage.h, SRC_W, SRC_H, rect(G.book), DOCK_RESERVE)
        : null;

    return (
        <BookNavContext.Provider value={nav}>
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

                {/* The room: light by the reader's clock, and dust in the
                    window beam. Above the photograph, below the words. */}
                <DaylightGrade />
                <Dust />

                {fit &&
                    holds.map((h, i) => (
                        <Spread
                            key={h.spread}
                            hold={h}
                            prev={holds[i - 1]}
                            next={holds[i + 1]}
                            fit={fit}
                            progress={progress}
                        />
                    ))}

                {fit && <PopupLayer fit={fit} stage={stage} />}

                {/* The fountain pen that writes each page's text. */}
                {fit && <PenLayer fit={fit} stage={stage} stageRef={stageRef} />}

                {/* The cat: passing through the overhead pages, and at the
                    end, on the table to be petted. */}
                {fit && cat.enabled && <CatLayer fit={fit} />}
                {fit && cat.enabled && <EndLayer fit={fit} />}

                {/* Things hanging from the top of the page: the lamp's pull
                    chain (the theme switch) and the bookmark ribbon. */}
                <LampChain />
                <Ribbon />
            </div>
        </div>
        </BookNavContext.Provider>
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
    prev,
    next,
    fit,
    progress,
}: {
    hold: Hold;
    prev?: Hold;
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

    /* Past halfway into view: interactive, and the pen may write on it.
       Below it the spread is inert, so nothing invisible can be tabbed to
       or clicked. */
    const [active, setActive] = useState(() => spreadShowing(hold, progress.get()));
    useMotionValueEvent(progress, "change", (p) => {
        const v = spreadShowing(hold, p);
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

    const pageWidth = place(fit, rect(G.pages.right)).width;

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
            data-hold={hold.spread}
            data-active={active || undefined}
            inert={!active}
            aria-hidden={!active}
        >
            <SpreadActiveContext.Provider value={active}>
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
            {slots.endText && endGeometry && (
                <div className={styles.endSlot} style={page(endGeometry.text)}>
                    {slots.endText}
                </div>
            )}
            {slots.left && (
                <div className={`${styles.page} ${styles.left}`} style={page(G.pages.left)}>
                    {slots.left}
                    {prev && prev.spread !== "cover" && (
                        <DogEar from={hold} to={prev} side="left" pageWidth={pageWidth} />
                    )}
                </div>
            )}
            {slots.right && (
                <div className={`${styles.page} ${styles.right}`} style={page(G.pages.right)}>
                    {slots.right}
                    {next && next.spread !== "closed" && (
                        <DogEar from={hold} to={next} side="right" pageWidth={pageWidth} />
                    )}
                </div>
            )}
            </SpreadActiveContext.Provider>
        </motion.div>
    );
}
