"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import { useLenis } from "lenis/react";
import { videoHero } from "@/lib/site";
import { useReducedMotion } from "@/lib/useReducedMotion";
import styles from "./VideoHero.module.css";

/* ==================================================================
   VIDEO HERO

   One screen, one claim, one way forward. It replaced a 700vh scrubbed
   frame sequence at the top of the page — that footage is still here,
   it is the About section now, and it earns its seven viewports better
   when it is not also doing the job of an introduction.

   Theme-locked on purpose. The footage is a fixed grade on deep navy
   and cannot follow a palette, so the type and the glass over it stay
   identical in both themes. Same call the two sequence sections made
   with #010101, and for the same reason: a themed surface over fixed
   pixels only ever looks like a mistake in one of the two themes.
   ================================================================== */

const { titleLead, titleMuted, body, ctaLabel, ctaHref, video, background } =
    videoHero;

export default function VideoHero() {
    /* No component split here.

       SequenceHero, ContactSequence and Footer each split into a static and a
       motion component because useScroll throws when its target ref is never
       hydrated, and hooks cannot be called conditionally. There is no
       useScroll in this component — nothing here is scroll-driven — so the
       reduced-motion branch is an ordinary ternary on one element. */
    const reduced = useReducedMotion();

    const videoRef = useRef<HTMLVideoElement>(null);
    const sectionRef = useRef<HTMLElement>(null);

    /* Undefined under reduced motion, where Lenis is never constructed. The
       handler below early-returns in that case and the browser's own anchor
       handling takes the click. */
    const lenis = useLenis();

    /* Pause once the hero is off screen.

       There are roughly twenty thousand pixels of page below this. A looping
       video decoding continuously under all of it is a GPU pass per frame for
       something nobody is looking at — the same reasoning that gates
       FooterTopo's rAF loop on an IntersectionObserver. */
    useEffect(() => {
        const el = sectionRef.current;
        const vid = videoRef.current;
        if (!el || !vid) return;

        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    /* play() returns a promise that REJECTS when the browser
                       refuses autoplay — an unhandled rejection in the console
                       on every load where a policy blocks it. Swallowed: the
                       poster is already showing, so a refused play degrades to
                       a still image rather than to an error. */
                    vid.play().catch(() => { });
                } else {
                    vid.pause();
                }
            },
            { rootMargin: "0px" },
        );

        io.observe(el);
        return () => io.disconnect();
        /* Re-run when the branch flips: under reduced motion there is no
           <video> to observe at all. */
    }, [reduced]);

    /* In-page hashes go through Lenis so the motion matches the dock and the
       footer rather than the browser's instant jump, which would fight the
       smooth scroll already running. Lifted from Footer.tsx. */
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
        /* id="top" — the dock's Home link and the footer's back-to-top both
           point at /#top, and this section owns that anchor now. */
        <section
            id="top"
            ref={sectionRef}
            className={styles.hero}
            /* One source of truth for the ground colour. It is painted under
               the video so the section is already the right colour in the
               moment before the first frame decodes, instead of flashing the
               page background through. */
            style={{ "--hero-bg": background } as CSSProperties}
        >
            {reduced ? (
                /* No autoplaying footage for someone who asked for less motion.
                   The poster is frame one of the same video, so the picture is
                   the same — it simply holds.

                   eslint-disable: next/image would buy nothing here. This is a
                   full-bleed background at a known path, not a content image
                   that needs srcset negotiation. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={video.poster}
                    alt=""
                    className={styles.media}
                    aria-hidden="true"
                />
            ) : (
                <video
                    ref={videoRef}
                    className={styles.media}
                    poster={video.poster}
                    /* All four are load-bearing. muted and playsInline are what
                       make iOS Safari autoplay at all; without either one it
                       shows a play button over the hero. */
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    aria-hidden="true"
                >
                    {/* WebM first — a browser takes the first source it can
                        decode, and VP9 is the smaller of the two. */}
                    <source src={video.webm} type="video/webm" />
                    <source src={video.mp4} type="video/mp4" />
                </video>
            )}

            <div className={styles.inner}>
                {/* The page's only <h1>, and a visible one. The section this
                    replaced carried a visually-hidden heading because its
                    canvas was decorative; there is nothing to hide here. */}
                <h1 className={styles.title}>
                    {titleLead}{" "}
                    {/* An <em> that is not italic. The emphasis is carried by
                        colour — the second half recedes to grey — which is a
                        real semantic emphasis rendered without a slant. */}
                    <em className={styles.titleMuted}>{titleMuted}</em>
                </h1>

                <p className={styles.sub}>{body}</p>

                {/* The wrapper is not decoration. It carries the entrance
                    animation so the button itself keeps its transform channel
                    free for the hover scale — see the note in the stylesheet,
                    this is a cascade trap rather than a preference. */}
                <span className={styles.ctaWrap}>
                    <Link
                        href={ctaHref}
                        className={styles.cta}
                        onClick={(e) => go(e, ctaHref)}
                    >
                        {ctaLabel}
                    </Link>
                </span>
            </div>
        </section>
    );
}
