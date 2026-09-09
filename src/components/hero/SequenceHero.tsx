"use client";

import { useEffect, useRef } from "react";
import { site } from "@/lib/site";
import { useReducedMotion } from "@/lib/useReducedMotion";
import scene from "../scene/scene.module.css";
import styles from "./SequenceHero.module.css";

/* ==================================================================
   HERO

   One viewport, one looping clip, and nothing over it. No scroll track
   and no scroll-driven motion of any kind: the section is exactly as
   tall as the window, and scrolling simply leaves it.

   THE CLIP IS NOT THE SUPPLIED FILE. It is public/new_hero_dark.mp4
   put through scripts/hero-loop.mjs, which closes the loop and evens
   out the grade. The reasoning and the measurements are in that
   script. The original is untouched and still on disk.
   ================================================================== */

const SRC = "/new_hero_dark_loop.mp4";

/* How far before the end the swap happens, in seconds. Two frames at
   30fps. Long enough that a 60Hz rAF cannot overshoot the end, short
   enough that the frames it skips are deep inside the dissolve, where
   the picture is already the one the next pass opens on. */
const SWAP_LEAD = 0.08;

export default function SequenceHero() {
    const reduced = useReducedMotion();

    return (
        <section id="top" className={`${styles.hero} ${scene.stage}`}>
            {reduced ? <Held /> : <Loop />}

            {/* Never seen, but it is the page's real <h1>. The footage is
                decorative, so without this the landing page has no heading
                at all for a screen reader or a crawler. */}
            <h1 className={styles.sr}>
                {site.name}. {site.role}. {site.tagline}
            </h1>
        </section>
    );
}

/* ------------------------------------------------------------------
   TWO ELEMENTS, NOT ONE WITH loop.

   The `loop` attribute is the obvious way to do this and it is the
   reason the clip visibly hitched. Watching the media events across
   three wraps, every single one fired `seeking` AND `waiting` —
   `waiting` being the element telling you outright that it has run out
   of data and stopped. The file is 5 MB and fully buffered; it stalls
   anyway, because looping is implemented as a seek and a seek discards
   the decode pipeline.

   So playback never seeks. Two elements hold the same clip: one plays
   while the other sits paused at its first frame, already decoded and
   already painting that frame. Two frames before the end they trade
   places. The retired one then rewinds, which is still a seek, but it
   is off screen with five seconds of slack instead of in front of the
   viewer with none.

   This only works because the clip's last frame and first frame are
   now the same picture. On the supplied file the swap would be just as
   smooth mechanically and just as ugly to look at, which is why the
   ffmpeg pass and this component are two halves of one fix.
   ------------------------------------------------------------------ */
function Loop() {
    const aRef = useRef<HTMLVideoElement>(null);
    const bRef = useRef<HTMLVideoElement>(null);

    /* Which element is showing. A ref rather than state: this flips on an
       animation frame and must never cause a render — re-rendering two
       <video> elements mid-playback is how you get a flash. */
    const front = useRef<"a" | "b">("a");

    useEffect(() => {
        const a = aRef.current;
        const b = bRef.current;
        if (!a || !b) return;

        /* Autoplay can be refused, and that is not an error worth throwing.
           A muted, inline video is allowed everywhere current, but a browser
           in a strict data-saver mode may still decline; the section then
           shows a held first frame, which is a fair outcome. */
        const start = (v: HTMLVideoElement) => {
            const p = v.play();
            if (p) void p.catch(() => { });
        };

        a.style.opacity = "1";
        b.style.opacity = "0";
        start(a);

        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);

            const showing = front.current === "a" ? a : b;
            const waiting = front.current === "a" ? b : a;

            /* duration is NaN until metadata lands. */
            if (!showing.duration) return;
            if (showing.currentTime < showing.duration - SWAP_LEAD) return;

            /* Reveal before concealing, so there is never a frame with
               neither of them visible. They are showing the same picture at
               this instant, so the overlap is not visible either. */
            waiting.style.opacity = "1";
            start(waiting);
            showing.style.opacity = "0";
            showing.pause();
            /* The seek, now that nobody is looking at it. */
            showing.currentTime = 0;

            front.current = front.current === "a" ? "b" : "a";
        };
        raf = requestAnimationFrame(tick);

        /* Backstop. requestAnimationFrame does not run in a hidden tab, so a
           visitor who switches away mid-clip comes back to an element that
           reached its end with nobody to retire it. This is the old looping
           behaviour, firing only when the swap was missed. */
        const onEnded = (e: Event) => {
            const v = e.currentTarget as HTMLVideoElement;
            const isFront = (front.current === "a" ? a : b) === v;
            v.currentTime = 0;
            if (isFront) start(v);
        };
        a.addEventListener("ended", onEnded);
        b.addEventListener("ended", onEnded);

        return () => {
            cancelAnimationFrame(raf);
            a.removeEventListener("ended", onEnded);
            b.removeEventListener("ended", onEnded);
        };
    }, []);

    /* muted + playsInline is what makes autoplay legal on every current
       browser, and the file carries no audio track, so nothing is being
       silenced. No `loop` on either, deliberately — see above. */
    const shared = {
        className: scene.plate,
        src: SRC,
        muted: true,
        playsInline: true,
        preload: "auto" as const,
        "aria-hidden": true,
    };

    return (
        <>
            <video ref={aRef} {...shared} autoPlay />
            <video ref={bRef} {...shared} />
        </>
    );
}

/* Reduced motion gets controls and no autoplay. The controls are the one
   thing here that is not the video, and they earn their place: without
   them this branch is a frozen first frame with no way to ever see the
   shot. */
function Held() {
    return (
        <video
            className={scene.plate}
            src={SRC}
            controls
            muted
            playsInline
            preload="metadata"
        />
    );
}
