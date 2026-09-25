"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import SakuraScene, { type AnchorMessage } from "./SakuraScene";
import { StageContext } from "../journey/stage";
import FlipFadeText from "../hero/FlipFadeText";
import { useInView } from "@/lib/useinview";
import { projects, projectsIntro, type Project } from "@/lib/site";
import styles from "./ProjectStack.module.css";

/* ==================================================================
   PROJECTS — four cards composed into a blossoming bough

   The cards are ordinary DOM in the host page; the bough is an authored
   Three.js scene inside a sandboxed iframe. Neither knows about the
   other's internals, and the sandbox is `allow-scripts` with no
   `allow-same-origin`, deliberately.

   THE ARRANGEMENT IS COMPOSED, NOT DERIVED. An earlier version read four
   branch points out of the scene each frame and hung a card off each
   one. That welded the cards to real bark, but it also meant the
   arrangement was whatever the geometry happened to do at a given
   viewport width, and a derived arrangement cannot be made to match a
   drawn one. LAYOUT below is the composition; the scene is what it is
   composed against.

   What still comes from the scene is one bit: whether its entrance has
   finished, so the cards can arrive as the boughs finish growing rather
   than before them.

   Which side of the bough a card is on is CSS — see the depth ladder in
   ProjectStack.module.css. The scene sits between the two card layers,
   so a "behind" card is genuinely covered by bark pixels.
   ================================================================== */

/* THE COMPOSITION IS AUTHORED, and that is a deliberate reversal.

   Placement used to be derived at runtime from branch points the scene
   picked out of its own geometry. That kept every card welded to real
   bark, but it meant the arrangement was whatever the boughs happened to
   do at that viewport width — and no amount of tuning makes a derived
   arrangement match a drawn one.

   The sketch asks for a composition: a named spot and a named depth for
   each card, with the branch threading between them. So the four
   positions are authored here, in the one place, and the scene is what
   they are composed AGAINST rather than what dictates them.

   The trade is real and worth naming: these do not track the boughs
   automatically any more. What makes it safe is that the composition is
   stable in PROPORTION — the camera holds a fixed horizontal fov, so the
   left arch crests near a third across and the right limb bends near
   four fifths at every width measured. The positions are percentages for
   exactly that reason.

   `depth` is the other half of the sketch. "behind" means the bough is
   drawn over the card; the two behind cards are placed so it crosses
   their RIGHT side, where the arrow is, because the project name sits
   bottom-left and has to survive. */
const LAYOUT = [
    /* Murmur — leftmost, in front, seated on the left arch's rise. */
    { cx: 11, bottom: 70, depth: "front" },
    /* Bail Reckoner — right portion over the arch's crest, behind it. */
    { cx: 38, bottom: 68, depth: "behind" },
    /* BU-GPT — level with the right limb's bend, right edge into it. */
    { cx: 68, bottom: 50, depth: "behind" },
    /* Kine-sense — rightmost and lowest, in front, over the limb past
       the bend where the moss shows through. */
    { cx: 86, bottom: 76, depth: "front" },
] as const;

type Mode = "perched" | "columns" | "stack";

export default function ProjectStack() {
    /* Two pieces of state, and no DOM writes at all any more: the
       composition is CSS, so there is nothing for script to position. */
    const [mode, setMode] = useState<Mode>("stack");
    const [grown, setGrown] = useState(false);

    /* Guards the one-way latch below so the handler does not call
       setState on every frame the scene publishes. */
    const grownRef = useRef(false);

    /* ---- SHOULD THIS SECTION BE SHOWING? ---------------------------
       Two answers, depending on where it has been put.

       ON JOURNEY'S STAGE (the normal case). Projects is pinned over the
       frame the camera comes to rest on, so it is sitting at the top of
       the window well before the camera gets there — its own position
       says nothing useful. Journey says it instead: `shown` once the
       camera has settled on the last frame, and the whole section fades
       in on the spot. Nothing slides in; it appears where the picture
       already is. See ../journey/stage.ts.

       AS AN ORDINARY SECTION (reduced motion, where Journey renders no
       stage). Then its position is the answer: it shows once it has
       LANDED — top edge within the top 8% of the window, bottom edge not
       yet gone. Because the section is always at least a windowful tall
       that is a range, not a threshold, so no scroll can step over it;
       and the 8% absorbs the 2rem an anchor jump stops short by. */
    const stage = useContext(StageContext);
    const { ref, inView: landed } = useInView<HTMLElement>({
        threshold: 0,
        rootMargin: "0px 0px -92% 0px",
        once: false,
    });
    const arrived = stage ? stage.shown : landed;

    /* The tree is a WebGL iframe carrying ~800 KB of inlined three.js.
       On the stage it is on screen long before it is wanted, so it waits
       to be built until Journey says the camera has entered its settle —
       the one stretch where nothing on screen is moving to show the cost.
       Standalone, it mounts as it always did. */
    const sceneOn = stage ? stage.boot : true;

    /* Layout mode from the container, not from a device guess. Four
       readable cards need roughly 4 x 220 plus gaps and padding. */
    useEffect(() => {
        const wide = window.matchMedia("(min-width: 64rem)");
        const mid = window.matchMedia("(min-width: 40rem)");
        const pick = () =>
            setMode(wide.matches ? "perched" : mid.matches ? "columns" : "stack");
        pick();
        wide.addEventListener("change", pick);
        mid.addEventListener("change", pick);
        return () => {
            wide.removeEventListener("change", pick);
            mid.removeEventListener("change", pick);
        };
    }, []);

    /* The one thing still read from the scene: its entrance finishing.

       Everything positional is authored now, so there is nothing per
       frame to apply. This stays a callback rather than becoming state
       plumbing because the scene publishes on every animation frame and
       only the FIRST message that reports a finished entrance matters —
       the ref latch is what stops the other few hundred calling
       setState. */
    const onAnchors = useCallback((msg: AnchorMessage) => {
        if (msg.entranceDone && !grownRef.current) {
            grownRef.current = true;
            setGrown(true);
        }
    }, []);

    /* The scene's entrance signal is preferred, but it cannot be the only
       way in.

       Gating purely on it meant the cards stayed invisible whenever the
       scene did not report at all — no WebGL, a slow mount, a lost
       context. The section rendered completely empty. So a timer runs
       alongside: whichever arrives first reveals the cards.

       Longer than the authored SCAN_DUR of 3.4s on purpose, so in the
       normal case the scene's own signal is what fires and the cards
       still follow the branches growing in. This only takes over when
       that signal never comes.

       IT COUNTS FROM ARRIVAL, not from coming into view. Those used to be
       the same moment; now `inView` is true a screen earlier, while the
       camera is still settling, so a visitor who dwells there would spend
       the whole 4.5s before landing and the cards would appear WITH the
       heading instead of after the tree. */
    const [timedOut, setTimedOut] = useState(false);
    useEffect(() => {
        if (!arrived || grown) return;
        const t = window.setTimeout(() => setTimedOut(true), 4500);
        return () => window.clearTimeout(t);
    }, [arrived, grown]);

    /* Re-arms on its own when the section leaves and lands again, because
       `arrived` is the gate. Resetting `grown` instead would strand the
       cards: the scene only posts when its message changes, so after a
       reset it would sit silent and they would never come back. */
    const revealed = (grown || timedOut) && arrived;

    return (
        <section
            /* On the stage the id lives on a marker in Journey's track
               instead: this element is pinned, and an anchor on a pinned
               element resolves to wherever it is stuck, not to the scroll
               position that shows it. */
            id={stage ? undefined : "projects"}
            ref={ref}
            className={styles.section}
            data-mode={mode}
            /* Drives the heading, the scene's fade and the section's own
               lighting in CSS, and makes the state inspectable from
               outside the way Journey's data-phase is. */
            data-arrived={arrived || undefined}
            /* Blacked out by the wipe into Contact: still here, but nothing
               in it may take a click or keyboard focus. */
            inert={stage?.covered || undefined}
        >
            {sceneOn && <SakuraScene className={styles.scene} onAnchors={onAnchors} />}

            {/* The eyebrow is copy that already existed and was never
                rendered here — projectsIntro.eyebrow in site.ts. Nothing
                new is invented for the heading. It is decorative to a
                screen reader: the h2 alone names the section, and having
                "Selected work" announced ahead of "Projects" would add a
                second label for one thing. */}
            <div className={styles.head}>
                <span className={styles.eyebrow} aria-hidden="true">
                    {projectsIntro.eyebrow}
                </span>
                <h2 className={styles.title}>
                    <FlipFadeText text={projectsIntro.title} active={arrived} />
                </h2>
            </div>

            {/* Transparent to the pointer, so the scene underneath keeps
                its parting and trails. Only the cards take input. */}
            <div className={styles.overlay} data-revealed={revealed || undefined}>
                {projects.map((project, i) => (
                    <div key={project.no} className={styles.slot}>
                        {/* No connector. A card seated on the bough does
                            not need a line drawn to it to read as resting
                            there, and nothing in the composition has one. */}
                        <article
                            className={styles.card}
                            data-depth={LAYOUT[i].depth}
                            style={{ "--d": `${i * 0.12}s` } as React.CSSProperties}
                        >
                            <Card project={project} index={i} />
                        </article>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------
   One card. A single link wraps the whole thing, so the arrow is part
   of the link rather than a button nested inside one.
   ------------------------------------------------------------------ */
function Card({ project, index }: { project: Project; index: number }) {
    const label = `${project.title} — ${project.kind}`;
    const body = (
        <span className={styles.lift}>
            <span className={styles.preview}>
                {project.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={project.image}
                        alt={`${project.title} project preview`}
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    /* No invented screenshot. A neutral plate that still
                       carries the real project name. */
                    <span className={styles.previewEmpty}>{project.title}</span>
                )}
            </span>

            <span className={styles.text}>
                <span className={styles.kind}>{project.kind || `Project ${project.no}`}</span>
                <span className={styles.name}>{project.title}</span>
            </span>

            <span className={styles.arrow} aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8h9M8.8 4.3 12.5 8l-3.7 3.7" />
                </svg>
            </span>

            {/* Decorative blossom overlapping the lower-right corner. */}
            <span className={styles.blossom} aria-hidden="true">
                <Blossom />
            </span>
        </span>
    );

    /* Every project in this data has a repo. If one ever does not, it
       stays a plain article rather than acquiring an invented link. */
    return project.repo ? (
        <a
            className={styles.link}
            href={project.repo}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={label}
            style={{ "--i": index } as React.CSSProperties}
        >
            {body}
        </a>
    ) : (
        <span className={styles.link} data-static="true">{body}</span>
    );
}

/* A small cluster of five petals. Inline rather than an asset, because
   it is three paths and the section already carries 800 KB of scene. */
function Blossom() {
    return (
        <svg viewBox="0 0 48 40" fill="none" aria-hidden="true">
            <g fill="#E8BDC7">
                <circle cx="14" cy="16" r="7.5" />
                <circle cx="25" cy="11" r="6" />
                <circle cx="33" cy="19" r="7" />
                <circle cx="22" cy="24" r="6.5" />
                <circle cx="40" cy="12" r="4.5" />
            </g>
            <g fill="#F5DEDC">
                <circle cx="16" cy="14" r="3" />
                <circle cx="31" cy="17" r="2.6" />
                <circle cx="24" cy="22" r="2.2" />
            </g>
            <g fill="#D79AAA">
                <circle cx="14" cy="16" r="1.7" />
                <circle cx="33" cy="19" r="1.5" />
            </g>
        </svg>
    );
}
