"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { projects, projectsIntro, type Project } from "@/lib/site";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useInView } from "@/lib/useinview";
import FlipFadeText, { letterVariants } from "../hero/FlipFadeText";
import ProjectLens from "./ProjectLens";
import styles from "./ProjectStack.module.css";

/* The intro is the first card, not a heading above the deck — so it is part of
   the same slide list and animates exactly like the rest. */
type Slide =
    | { kind: "intro" }
    | { kind: "project"; project: Project };

const slides: Slide[] = [
    { kind: "intro" },
    ...projects.map((project) => ({ kind: "project" as const, project })),
];

export default function ProjectStack() {
    const reduced = useReducedMotion();
    const container = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<(HTMLElement | null)[]>([]);

    /* -1 means "not reached yet", so the first card still gets its entrance
       when the section arrives rather than having played it off screen.
       Under reduced motion every card is simply on. */
    const [activeIndex, setActiveIndex] = useState(reduced ? Infinity : -1);

    /* The first card's reveal is driven by the DECK filling the viewport, not
       by the pin and not by the section.

       Not the pin: ScrollTrigger's start is "top top", but the dock link
       honours scroll-padding-top and lands 32px above that, so the trigger
       never activated and anyone arriving from the nav got a full-screen card
       with every letter still at opacity 0.

       Not the section either: with pinSpacing the section's box is about five
       viewports tall, so at threshold 0 it counted as "in view" the moment its
       top edge appeared below About — a whole screen before the card was
       visible. The flip played out off screen and was over by the time anyone
       scrolled to it.

       The deck is exactly one viewport, so a majority threshold on it means
       "the card is actually on screen now". */
    const { ref: deckRef, inView } = useInView<HTMLDivElement>({
        once: false,
        threshold: 0.55,
        rootMargin: "0px",
    });

    /* Derived during render rather than pushed into state from an effect.

       Mirroring `inView` into activeIndex with a setState would be a second
       source of truth for the same fact, and a cascading render every time the
       observer fires. The floor is simply "is the section on screen"; the
       timeline raises it from there. */
    const revealed = Math.max(activeIndex, inView ? 0 : -1);

    /* ScrollTrigger listens to native scroll events. Lenis animates the real
       document scroll, so they mostly agree — but Lenis drives it from its own
       rAF loop, and without this the pin can lag a frame behind the cards.
       Undefined under reduced motion, where Lenis is never constructed. */
    const lenis = useLenis();
    useEffect(() => {
        if (!lenis) return;
        const update = () => ScrollTrigger.update();
        lenis.on("scroll", update);
        return () => {
            lenis.off("scroll", update);
        };
    }, [lenis]);

    useGSAP(
        () => {
            /* No pin, no timeline, no ScrollTrigger at all — the cards fall back
               to an ordinary stacked list in CSS. Pinning a section is the most
               disorienting thing on this page for someone who asked for less
               motion. */
            if (reduced) return;

            gsap.registerPlugin(ScrollTrigger);

            const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
            const total = cards.length;
            if (total < 2) return;

            /* Every card starts full-bleed with square corners. The section
               should not announce itself as a deck of cards — it reads as a
               full-screen panel until the first scroll, and the card shape only
               emerges as one recedes behind the next. */
            gsap.set(cards[0], {
                yPercent: 0,
                scale: 1,
                rotation: 0,
                borderRadius: 0,
            });
            for (let i = 1; i < total; i++) {
                gsap.set(cards[i], {
                    yPercent: 100,
                    scale: 1,
                    rotation: 0,
                    borderRadius: 0,
                });
            }

            const timeline = gsap.timeline({
                scrollTrigger: {
                    trigger: container.current,
                    start: "top top",
                    /* A function, not a baked string. The original captured
                       window.innerHeight once at setup, so the pin length was
                       frozen at whatever the viewport happened to be on mount —
                       a resize or a phone rotating then left the pin ending in
                       the wrong place, and the ResizeObserver's refresh could
                       not fix a value that had already been stringified. */
                    end: () => `+=${window.innerHeight * (total - 1)}`,
                    pin: true,
                    scrub: 0.5,
                    pinSpacing: true,
                    invalidateOnRefresh: true,

                    /* Which card is currently front. Rounding rather than
                       flooring means a card counts as arrived once it is
                       halfway up, so its copy flips in as it settles instead of
                       after it has already stopped. */
                    onUpdate: (self) => {
                        const next = Math.round(self.progress * (total - 1));
                        setActiveIndex((prev) => (prev === next ? prev : next));
                    },
                    /* onUpdate only fires WHILE the trigger is active, so
                       arriving at the section from the dock link — which lands
                       exactly on the pin's start — left the first card sitting
                       there with every letter still at opacity 0 until the
                       reader nudged the scroll. These fire on arrival. */
                    onEnter: () => setActiveIndex((prev) => Math.max(prev, 0)),
                    onEnterBack: () => setActiveIndex((prev) => Math.max(prev, 0)),

                    /* Scrolled back above the section: nothing is front, so the
                       whole deck resets and plays again on the way down. */
                    onLeaveBack: () => setActiveIndex(-1),
                },
            });

            for (let i = 0; i < total - 1; i++) {
                timeline.to(
                    cards[i],
                    {
                        scale: 0.92,
                        rotation: 4,
                        /* Corners round off only as the card pulls back, so
                           "this is a card" is something the scroll reveals
                           rather than something the layout states upfront. */
                        borderRadius: 26,
                        duration: 1,
                        ease: "none",
                    },
                    i,
                );
                timeline.to(
                    cards[i + 1],
                    { yPercent: 0, duration: 1, ease: "none" },
                    i,
                );
            }

            const ro = new ResizeObserver(() => ScrollTrigger.refresh());
            if (container.current) ro.observe(container.current);

            return () => {
                ro.disconnect();
                /* Kills only this timeline's own trigger.

                   The original ran ScrollTrigger.getAll().forEach(t => t.kill()),
                   which tears down every trigger on the page — including any
                   belonging to other components. Nothing else uses ScrollTrigger
                   here yet, so it would not bite today; it would bite silently
                   the first time something else did. */
                timeline.scrollTrigger?.kill();
                timeline.kill();
            };
        },
        { scope: container, dependencies: [reduced] },
    );

    return (
        <section id="projects" className={styles.section}>
            <div
                ref={container}
                className={styles.stage}
                data-static={reduced || undefined}
            >
                <div ref={deckRef} className={styles.deck}>
                    {slides.map((slide, i) => (
                        <article
                            key={slide.kind === "intro" ? "intro" : slide.project.no}
                            ref={(el) => {
                                cardRefs.current[i] = el;
                            }}
                            className={styles.card}
                            data-intro={slide.kind === "intro" || undefined}
                        >
                            {slide.kind === "project" ? (
                                <Media project={slide.project} />
                            ) : null}

                            {/* Project cards only. The intro card is a title
                                page — there is nothing behind it to open, so a
                                cursor promising a destination would be lying. */}
                            {slide.kind === "project" ? (
                                <ProjectLens
                                    href={slide.project.repo}
                                    label={`${slide.project.title} on GitHub`}
                                >
                                    {/* The lens copy. Same markup as the real
                                        card so the magnifier lines up exactly,
                                        but frozen — no second set of motion
                                        components for every letter.

                                        The artwork is copied too: without it
                                        the lens would show magnified text on
                                        bare background and the illusion would
                                        break the moment it crossed the image. */}
                                    <Media project={slide.project} />
                                    <div className={styles.cardInner}>
                                        <ProjectCard
                                            project={slide.project}
                                            active
                                            frozen
                                        />
                                    </div>
                                </ProjectLens>
                            ) : null}

                            {/* The card is now the full viewport, so the copy
                                needs its own measure — otherwise the number and
                                the period end up at opposite ends of a 2560px
                                screen with a desert between them. */}
                            <div className={styles.cardInner}>
                                {slide.kind === "intro" ? (
                                    <IntroCard active={revealed >= i} />
                                ) : (
                                    <ProjectCard
                                        project={slide.project}
                                        active={revealed >= i}
                                    />
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

function IntroCard({ active }: { active: boolean }) {
    return (
        <>
            <header className={styles.cardTop}>
                <FlipFadeText
                    text={projectsIntro.eyebrow}
                    active={active}
                    className={styles.eyebrow}
                />
            </header>

            <div className={styles.cardBody}>
                {/* The section's real heading. It lives on the card rather than
                    above the deck, so this is still the <h2> for the section. */}
                <h2 className={styles.introTitle}>
                    <FlipFadeText
                        text={projectsIntro.title}
                        active={active}
                        letterDuration={0.7}
                        staggerDelay={0.07}
                    />
                </h2>
                <div className={styles.introLines}>
                    {projectsIntro.lines.map((line) => (
                        <p key={line} className={styles.introLine}>
                            <FlipFadeText text={line} active={active} />
                        </p>
                    ))}
                </div>
            </div>

            <footer className={styles.cardFoot} aria-hidden="true">
                <span className={styles.cardFootRule} />
                <FlipFadeText
                    text={`${projects.length} projects`}
                    active={active}
                />
            </footer>
        </>
    );
}

/* Sits outside cardInner so it fills the whole card, not the measure. */
function Media({ project }: { project: Project }) {
    return (
        /* Decorative, so no alt text — the card's own heading and copy already
           say what this is, and a description of the artwork would just be
           noise between them. */
        <div className={styles.media} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={project.image}
                alt=""
                className={styles.mediaImg}
                loading="lazy"
                decoding="async"
            />
            <span className={styles.scrim} />
        </div>
    );
}

function ProjectCard({
    project,
    active,
    frozen = false,
}: {
    project: Project;
    active: boolean;
    /* Renders the identical DOM with no motion — used for the lens copy. */
    frozen?: boolean;
}) {
    return (
        <>
            {/* No index any more. With the cards full-bleed there is nothing
                for a "01" to number — the stack itself shows the position, and
                a lone digit floating in the corner of a full screen read as a
                stray artefact rather than as a label.

                `no` is still on the Project type: it is the React key and the
                stable identity for reordering. */}
            {project.period ? (
                <header className={styles.cardTop}>
                    <FlipFadeText
                        text={project.period}
                        active={active}
                        frozen={frozen}
                        className={styles.period}
                    />
                </header>
            ) : (
                <span aria-hidden="true" />
            )}

            <div className={styles.cardBody}>
                <p className={styles.kind}>
                    <FlipFadeText text={project.kind} active={active} frozen={frozen} />
                </p>
                <h3 className={styles.title}>
                    <FlipFadeText
                        text={project.title}
                        active={active}
                        frozen={frozen}
                        letterDuration={0.7}
                        staggerDelay={0.07}
                    />
                </h3>
                <p className={styles.detail}>
                    {/* The spread cap does the work here — this sentence would
                        otherwise take eight seconds to finish arriving. */}
                    <FlipFadeText text={project.detail} active={active} frozen={frozen} />
                </p>
            </div>

            {/* Chips flip as whole units rather than letter by letter.

                Six chips of eight characters each is roughly fifty spans all
                pivoting at once — it reads as static, not as motion, and buys
                nothing. Flipping each chip as one object uses the same
                variants and stays legible. */}
            <motion.ul
                className={styles.tech}
                initial="initial"
                animate={active ? "animate" : "exit"}
                variants={{
                    initial: {},
                    animate: { transition: { staggerChildren: 0.05 } },
                    exit: { transition: { staggerChildren: 0.02 } },
                }}
            >
                {project.tech.map((name) => (
                    <motion.li
                        key={name}
                        className={styles.chip}
                        variants={letterVariants(0.55)}
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        {name}
                    </motion.li>
                ))}
            </motion.ul>
        </>
    );
}
