"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

/* ==================================================================
   A CLIP THAT LOOPS WITHOUT HITCHING

   Used by the hero and by About. Extracted from the hero, where it was
   built and measured; the logic below is subtle enough that a second
   copy would drift from this one within a change or two.

   ------------------------------------------------------------------
   TWO ELEMENTS, NOT ONE WITH `loop`.

   The `loop` attribute is the obvious way to do this and it is the
   reason the hero clip visibly hitched. Watching the media events
   across three wraps, every single one fired `seeking` AND `waiting` —
   `waiting` being the element telling you outright that it has run out
   of data and stopped. The file was 5 MB and fully buffered; it stalled
   anyway, because looping is implemented as a seek and a seek discards
   the decode pipeline.

   So playback never seeks. Two elements hold the same clip: one plays
   while the other sits paused on its first frame, already decoded and
   already painting it. Two frames before the end they trade places. The
   retired one then rewinds — still a seek, but off screen with the
   whole clip's length of slack instead of in front of the viewer with
   none.

   THIS ONLY WORKS ON A CLIP WHOSE LAST FRAME MATCHES ITS FIRST. On a
   raw generated clip the swap is just as smooth mechanically and just
   as ugly to look at. Both clips on this site are put through an ffmpeg
   pass that dissolves the head onto the tail first — scripts/hero-loop.mjs
   and scripts/about-loop.mjs. The encode and this component are two
   halves of one fix, and neither works alone.
   ================================================================== */

/* How far before the end the swap happens, in seconds. Roughly two
   frames. Long enough that a 60Hz rAF cannot overshoot the end, short
   enough that the frames it skips are deep inside the dissolve, where
   the picture is already the one the next pass opens on. */
const SWAP_LEAD = 0.08;

export default function SeamlessVideo({
    src,
    className,
    poster,
    /** A still to show instead of the clip when motion is reduced. */
    stillSrc,
    stillAlt = "",
    /**
     * Whether the loop is running. Pausing keeps the current frame and
     * the current time; it is not a rewind.
     */
    playing = true,
}: {
    src: string;
    className?: string;
    poster?: string;
    stillSrc?: string;
    stillAlt?: string;
    playing?: boolean;
}) {
    const reduced = useReducedMotion();

    if (reduced) {
        /* Ambient footage is decoration, and decoration is exactly what
           reduced motion asks you to hold still. A poster where one is
           supplied; otherwise the clip with controls, so the shot is at
           least reachable rather than simply withheld. */
        return stillSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                className={className}
                src={stillSrc}
                alt={stillAlt}
                aria-hidden={stillAlt ? undefined : true}
            />
        ) : (
            <video
                className={className}
                src={src}
                poster={poster}
                controls
                muted
                playsInline
                preload="metadata"
            />
        );
    }

    return (
        <Loop src={src} className={className} poster={poster} playing={playing} />
    );
}

/* ------------------------------------------------------------------ */

function Loop({
    src,
    className,
    poster,
    playing,
}: {
    src: string;
    className?: string;
    poster?: string;
    playing: boolean;
}) {
    const aRef = useRef<HTMLVideoElement>(null);
    const bRef = useRef<HTMLVideoElement>(null);

    /* Which element is showing. A ref rather than state: this flips on an
       animation frame and must never cause a render — re-rendering two
       <video> elements mid-playback is how you get a flash. */
    const front = useRef<"a" | "b">("a");

    /* Read by the tick below, which lives in a mount-only effect and so
       can never see the prop itself. Written from an effect rather than
       during render, because React Compiler forbids the latter — this
       repo has already been caught by that rule twice. */
    const playingRef = useRef(playing);

    useEffect(() => {
        playingRef.current = playing;
        const el = front.current === "a" ? aRef.current : bRef.current;
        if (!el) return;
        if (playing) {
            const p = el.play();
            if (p) void p.catch(() => { });
        } else {
            /* pause(), never currentTime = 0. Rewinding is a seek, and
               avoiding seeks in front of the viewer is the entire reason
               there are two elements here. */
            el.pause();
        }
    }, [playing]);

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
        if (playingRef.current) start(a);

        let raf = 0;
        const tick = () => {
            raf = requestAnimationFrame(tick);

            /* A paused loop has nothing to hand over. */
            if (!playingRef.current) return;

            const showing = front.current === "a" ? a : b;
            const waiting = front.current === "a" ? b : a;

            /* duration is NaN until metadata lands. */
            if (!showing.duration) return;
            if (showing.currentTime < showing.duration - SWAP_LEAD) return;

            /* Do not hand over to an element that cannot play yet.
               HAVE_FUTURE_DATA is the lowest state that means "there is a
               next frame ready", and swapping below it puts a stalled
               video on screen — which is precisely the fault the two
               elements exist to avoid, just moved.

               Seen for real: on a dev server pushing 16 MB of video over
               HTTP/1.1, the second element had not finished buffering by
               its first swap and fired five `waiting` events. Production
               over HTTP/2 never reproduced it across three runs, but a
               visitor on a bad connection is the dev server.

               HAVE_ENOUGH_DATA, not HAVE_FUTURE_DATA. FUTURE_DATA only
               promises the next frame, which an element can satisfy and
               then run dry a moment later — tried it, and it cut the dev
               stalls from five to two rather than to none. ENOUGH_DATA is
               the browser saying it expects to reach the end without
               stopping, which is the actual question being asked here.

               Returning here simply lets the current element keep playing.
               If the other never becomes ready, `showing` reaches its end
               and the `ended` backstop below rewinds it — one seek, which
               is the old hitch, but only in the case where the alternative
               was a stall. */
            if (waiting.readyState < 4 /* HAVE_ENOUGH_DATA */) return;

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
            /* Not while deliberately paused — otherwise a loop that was
               told to stop restarts itself the moment it runs out. */
            if (isFront && playingRef.current) start(v);
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
       browser. No `loop` on either, deliberately — see above. */
    const shared = {
        className,
        src,
        muted: true,
        playsInline: true,
        preload: "auto" as const,
        "aria-hidden": true,
    };

    return (
        <>
            {/* Poster on the first element only. The second is never the one
                a visitor is looking at before playback starts. */}
            <video ref={aRef} {...shared} poster={poster} autoPlay />
            <video ref={bRef} {...shared} />
        </>
    );
}
