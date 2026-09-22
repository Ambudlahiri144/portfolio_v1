"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
    motion,
    useMotionValueEvent,
    useScroll,
    useSpring,
    useTransform,
} from "framer-motion";
import SeamlessVideo from "../video/SeamlessVideo";
import Seam from "../scene/Seam";
import SequenceCanvas from "../sequence/SequenceCanvas";
import { useFrameSequence } from "../sequence/useFrameSequence";
import FlipFadeText from "../hero/FlipFadeText";
import { useInView } from "@/lib/useinview";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { about, site } from "@/lib/site";
import scene from "../scene/scene.module.css";
import styles from "./Journey.module.css";

/* ==================================================================
   THE WAY IN: HERO, THE CAMERA MOVE, ABOUT, AND THE DESCENT — ONE
   SURFACE

   Four beats, and the picture never moves between them:

     1. You land. The hero clip loops.
     2. You scroll down. The clip stops where it is and 120 frames of
        camera move take over IN THE SAME PLACE, scrubbed by the
        scrollbar, travelling from the neon street down to the bridge
        over the canal.
     3. The camera comes to rest. The greeting flips in and the About
        clip takes over and loops.
     4. You scroll again. That clip stops where it is in its turn, and
        240 more frames lift the camera off the bridge and out over the
        valley, coming to rest on the picture the Projects section is
        already using as its background.

   Scroll back up and it runs in reverse; reach the top and the hero
   clip starts again.

   BEAT 4 IS BEAT 2 AGAIN, deliberately. Same mechanism, same spring,
   same kind of handover: a clip that pauses without rewinding, and
   frames that take the frame over in place. The only structural
   difference is that the second canvas cannot be scrubbed by the track's
   own progress, because it does not start at zero — see `descent` below.

   ------------------------------------------------------------------
   WHY THIS IS ONE COMPONENT AND NOT TWO SECTIONS.

   This was first built as a hero section with the scrub in a separate
   tall section beneath it, and that is wrong in a way you can see. The
   hero was 100svh of ordinary page, so the first thing scrolling did
   was slide it up and out while the next section's sticky panel slid in
   over it. Two near-identical pictures sliding past each other before
   anything scrubbed at all.

   The fix is not a tweak to that arrangement, it is the removal of it.
   The track starts at scroll 0, the sticky viewport is pinned from the
   very first pixel, and the hero clip, the frames and the About clip
   are three LAYERS of one surface rather than two boxes in a column.
   Nothing slides, because there is only ever one thing on screen and it
   is always in the same place. That is also why #top and #about are now
   two anchors into one section instead of two sections.
   ================================================================== */

const HERO_SRC = "/new_hero_dark_loop.mp4";
const ABOUT_SRC = "/new_about_loop.mp4";
const ABOUT_POSTER = "/about-poster.webp";

const FRAME_COUNT = 120;
const DESCENT_COUNT = 240;

/* The four beats as fractions of the track. The wrapper is 900svh and
   the sticky child is 100svh, so the child is pinned across 800svh and
   useScroll's 0..1 maps over exactly that:

     bridge scrub   0-300svh    0     -> 0.375   BRIDGE_END
     About holds    300-400     0.375 -> 0.5     DESCENT_START
     descent scrub  400-700     0.5   -> 0.875   DESCENT_END
     settle         700-800     0.875 -> 1

   The hold is not padding — it is how long the greeting is readable
   before the camera moves again. Journey.module.css carries the same
   arithmetic against the heights it sets. */
const BRIDGE_END = 0.375;
const DESCENT_START = 0.5;
const DESCENT_END = 0.875;

/* How much scroll a clip takes to hand the frame over. 0.6% of the track
   is about 43px of scrolling — long enough not to be a hard cut, short
   enough that it happens on the first flick of a wheel. The two pictures
   are always the same composition, so this only has to cover the petals
   being in different places.

   IT IS 0.006 RATHER THAN 0.012 BECAUSE THE TRACK DOUBLED. This was
   tuned in pixels, not in percent, and 1.2% of the old 400svh pinned
   range is 0.6% of the new 800svh one. Left at 0.012 it would quietly
   become an 86px fade — the number would look untouched and the feel
   would not be. The About clip's arrival window (0.015) was halved from
   0.03 for the same reason. */
const HANDOFF = 0.006;
const ARRIVAL = 0.015;
/* 24svh — five times the handover, for the reason given at skyOpacity. */
const SCRIM_FADE = 0.03;

/* Module scope, because useFrameSequence's internal useCallback depends
   on this identity and an inline function would restart the load.

   IT TAKES NO `small` ARGUMENT ON PURPOSE, and declaring one parameter
   where the caller passes three is deliberate: a narrower function
   satisfies the wider signature in TypeScript, so there is nothing to
   name-with-an-underscore and then ignore. wantsSmallSet() returns true
   below 1400 physical pixels, which is every phone, and there is no sm/
   set for the bridge — one full-size set was the decision. Honouring the
   argument would 404 every frame on mobile. */
function framePath(i: number) {
    return `/scene/bridge/frame-${String(i + 1).padStart(3, "0")}.webp`;
}

/* This one DOES take the `small` argument, where framePath above
   deliberately does not: 240 frames is twice the bridge's count, so
   unlike the bridge this set was built with an sm/ half-size world for
   the phones wantsSmallSet() catches below 1400 physical pixels.
   scripts/descent.mjs writes both. */
function descentPath(i: number, small: boolean) {
    return `/scene/descent/${small ? "sm/" : ""}frame-${String(i + 1).padStart(3, "0")}.webp`;
}

/* Split on the component, not inside it: hooks cannot be conditional,
   and the held branch has no scroll track for useScroll to measure.

   `children` is Projects. It is passed in rather than imported so that
   page.tsx still reads as the page's running order, but it is RENDERED
   INSIDE THE TRACK, because that is what keeps the valley pinned behind
   it — see the layer note in ScrollJourney. The held branch takes it
   too, where it becomes an ordinary section again. */
export default function Journey({ children }: { children?: React.ReactNode }) {
    return useReducedMotion() ? (
        <HeldJourney>{children}</HeldJourney>
    ) : (
        <ScrollJourney>{children}</ScrollJourney>
    );
}

/* ------------------------------------------------------------------ */

type Phase = "before" | "bridge" | "arrived" | "descent";

function ScrollJourney({ children }: { children?: React.ReactNode }) {
    /* The camera is measured against the RUNWAY, not the track. The track
       now also contains Projects, whose height varies with the layout and
       the viewport; the runway is a fixed 700svh, so the beats keep their
       arithmetic. Journey.module.css does that sum. */
    const runwayRef = useRef<HTMLDivElement>(null);

    /* No preload gate, unlike every other sequence on the site. There is
       nothing to defer behind: this is the top of the page and these
       frames are the first thing a scroll will ask for. Until they land
       the hero clip is playing over them, so there is nothing missing to
       look at either. */
    const { imagesRef, progress, ready, revision } = useFrameSequence({
        count: FRAME_COUNT,
        path: framePath,
    });

    /* ---- the descent's frames, gated twice ------------------------
       Journey is the one sequence on the site with no preload gate, and
       the comment above is still right about the BRIDGE. It is not right
       about this set, which is 11 MB and sits 400svh further down.

       1. `armed` — the visitor has actually started travelling. Someone
          who lands, looks, and leaves should not pay for a beat they
          never reach.
       2. `ready` — the bridge's frames are in. They are what the first
          scroll scrubs, and nothing may compete with them for the
          connection while that is happening.

       By the time both are true the hero clip is usually still looping,
       so this still has a long run-up to being needed. */
    const { ref: armRef, inView: armed } = useInView<HTMLSpanElement>({
        threshold: 0,
        rootMargin: "150% 0px",
        once: true,
    });

    /* Named apart from the first because two different things here are
       called `progress`: the hook returns a NUMBER (how much of the set
       has loaded, which drives the loader bar) while SequenceCanvas takes
       a MotionValue (where the scroll is). */
    const descentSeq = useFrameSequence({
        count: DESCENT_COUNT,
        path: descentPath,
        enabled: armed && ready,
    });

    const { scrollYProgress } = useScroll({
        target: runwayRef,
        offset: ["start end", "end start"],
    });

    /* The site-wide spring. Keeping one in the chain also matters for a
       reason Footer.tsx documents: a plain useTransform of a raw
       useScroll value handed to a motion element gets promoted to the
       native scroll-linked animation API and freezes at its initial
       value. A spring forces it to stay JS-driven. */
    const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 28 });

    /* Three states out of continuous values, without rendering on every
       tick — the guard inside setPhase is what makes that true.

       THE TWO ENDS READ DIFFERENT VALUES, and that is the fix for a
       measured fault rather than a stylistic choice.

       Gating both on `smooth` made returning to the top take about five
       seconds to restart the hero clip. The spring is overdamped
       (damping ratio 1.67) so it crawls the last of the way: Lenis eases
       the window home in ~1.5s, then the spring needs another ~2.5s to
       get from 0.4 down under the threshold. For a camera glide that
       softness is the point; for a discrete decision it is lag. Reading
       raw scroll for this end took it to ~20ms.

       It is also the more correct signal: progress 0 is exactly the top
       of the page, so raw ~0 means "the hero is what you are looking
       at", which is precisely when its clip should run.

       `arrived` keeps reading the spring, for the opposite reason — the
       greeting should appear when the CAMERA has come to rest, not when
       the scrollbar has. Those are different moments, and the spring is
       the one the eye is watching. */
    const [phase, setPhase] = useState<Phase>("before");
    const sync = useCallback(() => {
        const next: Phase =
            scrollYProgress.get() <= 0.001
                ? "before"
                : smooth.get() >= DESCENT_START
                    ? "descent"
                    : smooth.get() >= BRIDGE_END
                        ? "arrived"
                        : "bridge";
        setPhase((prev) => (prev === next ? prev : next));
    }, [scrollYProgress, smooth]);
    useMotionValueEvent(scrollYProgress, "change", sync);
    useMotionValueEvent(smooth, "change", sync);

    const arrived = phase === "arrived";

    /* One bar, two sets. The bridge's frames are what the first scroll
       needs, so its progress owns the bar until it is complete; after
       that the bar only comes back if the visitor reaches the About hold
       before the descent's frames have landed — which is the one moment
       where waiting would otherwise be invisible and confusing. */
    const descentPending =
        !descentSeq.ready && (phase === "arrived" || phase === "descent");
    const loading = !ready || descentPending;
    const loadProgress = ready ? descentSeq.progress : progress;

    /* The hero clip hands the frame over as the scrub begins, and takes
       it back on the way home. Driven by the spring rather than by the
       phase so it is a fade rather than a switch. */
    const heroOpacity = useTransform(smooth, [0, HANDOFF], [1, 0]);

    /* The About clip arrives over the last of the bridge scrub, holds,
       and leaves again as the descent takes over. Its first frame and
       the last bridge frame are the same shot at slightly different
       scales — closing the clip's loop starts it at source t=0.8, which
       is already pushed in a little — so the arrival is a crossfade and
       not a swap.

       It arrives WITH the sky scrim and leaves more quickly than it. */
    const aboutOpacity = useTransform(
        smooth,
        [BRIDGE_END - ARRIVAL, BRIDGE_END, DESCENT_START, DESCENT_START + HANDOFF],
        [0, 1, 1, 0],
    );

    /* THE SCRIM LEAVES SLOWER THAN THE PICTURE IT SAT ON, and the two
       used to be one value. Measured on screen at the handover, the
       frame's saturation goes 11.1 -> 18.2 as the scrim lifts: that is
       the scrim's whole job (it darkens the picture so the greeting can
       be read), but spent over the handover's 43px it is a flash of the
       lights coming up rather than the camera moving on. Over 24svh it
       is the exposure settling, which is what it should look like — and
       the greeting above it takes 600ms to flip away regardless. */
    const skyOpacity = useTransform(
        smooth,
        [BRIDGE_END - ARRIVAL, BRIDGE_END, DESCENT_START, DESCENT_START + SCRIM_FADE],
        [0, 1, 1, 0],
    );

    /* The descent canvas fades in over the paused clip on the same
       handover the hero used. Mid-fade both layers are part-transparent
       and the bridge canvas shows through underneath, which is harmless:
       all three are the same composition from the same camera. */
    const descentOpacity = useTransform(
        smooth,
        [DESCENT_START, DESCENT_START + HANDOFF],
        [0, 1],
    );

    /* THE SECOND CANVAS CANNOT BE SCRUBBED BY THE TRACK'S OWN PROGRESS.
       SequenceCanvas computes its frame as progress/seqEnd, which
       assumes a sequence that starts at zero; this one starts at 0.5.
       Rather than add a seqStart prop to a component KatanaLoader also
       uses, remap the value and leave the canvas alone.

       useTransform clamps at both ends by default, which is exactly the
       behaviour wanted: frame 001 before the beat, and frame 240 held
       through the settle after it. It transforms the SPRING, not the raw
       scroll value, so the freezing trap noted above does not apply. */
    const descent = useTransform(smooth, [DESCENT_START, DESCENT_END], [0, 1]);

    return (
        <section
            id="top"
            className={styles.track}
            /* The one part of this that is otherwise invisible from
               outside: the phase lives in a motion value and a ref,
               neither of which can be inspected. */
            data-phase={phase}
        >
            <div className={`${styles.sticky} ${scene.stage}`}>
                {/* Bottom layer. Visible from the moment the hero clip
                    starts fading, and it holds the last frame through the
                    whole arrival, so there is never a gap behind the
                    About clip as it fades in. */}
                <SequenceCanvas
                    className={scene.plate}
                    imagesRef={imagesRef}
                    progress={smooth}
                    count={FRAME_COUNT}
                    seqEnd={BRIDGE_END}
                    fit="cover"
                    revision={revision}
                />

                <motion.div className={styles.layer} style={{ opacity: heroOpacity }}>
                    <SeamlessVideo
                        className={scene.plate}
                        src={HERO_SRC}
                        playing={phase === "before"}
                    />
                </motion.div>

                <motion.div className={styles.layer} style={{ opacity: aboutOpacity }}>
                    <SeamlessVideo
                        className={scene.plate}
                        src={ABOUT_SRC}
                        poster={ABOUT_POSTER}
                        playing={arrived}
                    />
                </motion.div>

                {/* The fourth beat, above the clip it takes over from.
                    Its own progress value, already remapped to 0..1
                    across the descent, so seqEnd stays at its default. */}
                <motion.div
                    className={styles.layer}
                    style={{ opacity: descentOpacity }}
                >
                    <SequenceCanvas
                        className={scene.plate}
                        imagesRef={descentSeq.imagesRef}
                        progress={descent}
                        count={DESCENT_COUNT}
                        fit="cover"
                        revision={descentSeq.revision}
                    />
                </motion.div>

                {/* Fades in with the About clip rather than sitting on for
                    the whole scrub. It exists to hold type, and there is no
                    type until the camera stops — left on throughout it just
                    dims the sky and the far hills through the one stretch
                    of this that is purely a camera move. */}
                <motion.span
                    className={styles.sky}
                    style={{ opacity: skyOpacity }}
                    aria-hidden="true"
                />

                {/* Never seen, but it is the page's real <h1>. The footage
                    is decorative, so without this the landing page has no
                    heading at all for a screen reader or a crawler. */}
                <h1 className={styles.sr}>
                    {site.name}. {site.role}. {site.tagline}
                </h1>

                <Copy visible={arrived} />

                {/* Non-blocking, and only while the frames are outstanding.
                    The hero clip is playing on top of the canvas until they
                    land, so there is nothing broken on screen to hide. */}
                {loading && (
                    <div className={styles.loader} role="status" aria-live="polite">
                        <span className={styles.loaderBar} aria-hidden="true">
                            <span
                                className={styles.loaderFill}
                                style={{ transform: `scaleX(${loadProgress})` }}
                            />
                        </span>
                    </div>
                )}
            </div>

            {/* The dock's About link needs somewhere to land. About is no
                longer a section, it is a position along this track — so
                this is a zero-height marker sitting at the scroll offset
                where the camera has arrived. */}
            <span id="about" className={styles.aboutAnchor} aria-hidden="true" />

            {/* WHERE THIS STARTS IS THE WHOLE MECHANISM, not decoration.
                It begins at the scroll offset where the descent does, and
                the observer's 150% root margin turns that into lead time:
                the root is expanded by 1.5 viewports, so it is seen once
                scrollY + 100svh + 150svh >= 400svh — that is, 150svh,
                halfway through the bridge scrub, leaving 250svh of
                scrolling to fetch the set before its first frame is due.

                The same margin on a marker at the TOP of the track, which
                is the idiom the other sections use, would fire at once and
                gate nothing. And it runs to the bottom of the track rather
                than being a point, so that a jump past it still arms it —
                see the CSS. */}
            <span ref={armRef} className={styles.armDescent} aria-hidden="true" />

            {/* The scroll the four beats are spent over, and what the
                camera is measured against. */}
            <div ref={runwayRef} className={styles.runway} aria-hidden="true" />

            {/* PROJECTS, INSIDE THE TRACK AND IN NORMAL FLOW.

                Not inside the sticky, which would clip it — .section is
                overflow:hidden and on a phone it is nearly twice the
                height of the window. In flow it grows to whatever it
                needs while the sticky above stays pinned behind it,
                because a sticky child is held by its containing block
                and this is that block.

                It has no background of its own any more, so while it
                rises into place it is invisible: the valley simply
                stays, and Projects reveals itself once it has landed.
                ProjectStack decides that moment from its own position —
                it is not told anything from here. */}
            {children}

            {/* Keeps the pin alive to Projects' last pixel. See the CSS. */}
            <div className={styles.tail} aria-hidden="true" />
        </section>
    );
}

/* ------------------------------------------------------------------
   Reduced motion: no track, no scrub, and none of the 15 MB of frames.
   Two ordinary viewports, which is what these two beats were before the
   camera move existed. Both anchors survive because they are once again
   two real sections.
   ------------------------------------------------------------------ */
function HeldJourney({ children }: { children?: React.ReactNode }) {
    const { ref, inView } = useInView<HTMLElement>({
        threshold: 0.4,
        rootMargin: "0px",
        once: false,
    });

    return (
        <>
            <section id="top" className={`${styles.held} ${scene.stage}`}>
                <SeamlessVideo className={scene.plate} src={HERO_SRC} />
                <h1 className={styles.sr}>
                    {site.name}. {site.role}. {site.tagline}
                </h1>
            </section>

            <section id="about" ref={ref} className={`${styles.held} ${scene.stage}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={scene.plate} src={ABOUT_POSTER} alt="" aria-hidden="true" />
                <span className={styles.sky} aria-hidden="true" />
                <Copy visible={inView} />
            </section>

            {/* THE SEAM COMES BACK HERE, AND ONLY HERE. page.tsx dropped it
                because in the scrolling branch there is no join left to
                soften — the camera rests on the valley and Projects
                arrives on top of that same picture. None of that is true
                on this branch: it is a poster of the bridge cut straight
                to a photograph of the valley, two different places, which
                is exactly what a seam is for. page.tsx cannot make this
                call itself — it is a server component and cannot read the
                motion preference. */}
            <Seam tint="#3A2B41" />

            {/* An ordinary section again: there is nothing pinned here for
                it to sit on, so it paints its own ground — see the
                reduced-motion rule in ProjectStack.module.css. */}
            {children}
        </>
    );
}

/* ------------------------------------------------------------------
   The greeting and the two buttons. Shared by both branches so the copy
   cannot drift between them.
   ------------------------------------------------------------------ */
function Copy({ visible }: { visible: boolean }) {
    return (
        <div
            className={`${styles.inner} ${scene.near}`}
            data-visible={visible || undefined}
        >
            <h2 className={`${styles.greeting} ${scene.onWorld}`}>
                <FlipFadeText text={about.greeting} active={visible} />
            </h2>

            <div
                className={styles.actions}
                style={{ "--d": "0.5s" } as React.CSSProperties}
            >
                <Link href="/experience" className={styles.btn}>
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

                <a href="#projects" className={styles.btn}>
                    My Contributions
                </a>
            </div>
        </div>
    );
}
