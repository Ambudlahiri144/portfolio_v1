"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import {
    motion,
    useMotionTemplate,
    useMotionValue,
    useScroll,
    useSpring,
    useTransform,
    type MotionValue,
} from "framer-motion";
import { useLenis } from "lenis/react";
import type { IconType } from "react-icons";
import { SiGithub, SiInstagram, SiLeetcode } from "react-icons/si";
import { FaEnvelope, FaLinkedinIn } from "react-icons/fa6";
import {
    footer,
    nav,
    projects,
    site,
    social,
    type SocialLink,
} from "@/lib/site";
import { useReducedMotion } from "@/lib/useReducedMotion";
import FooterTopo from "./FooterTopo";
import styles from "./Footer.module.css";

/* ==================================================================
   FOOTER — a 3D stage to end the page

   The name stands on a glossy floor with its reflection beneath it,
   over a drifting topographic grid. As the page reaches its end the
   whole stage rises out of the floor and stands upright, driven by
   scroll. Once settled it tilts toward the pointer, and because the
   wordmark, the columns and the meta row sit at different depths they
   shift against each other. A sheen slides across the letters as it
   tilts.

   CSS 3D, not WebGL, for the stage itself. three.js is installed but
   without a model it can only draw primitives or particles, which is
   the look the old hero had and the footage replaced. Perspective
   transforms give real depth here with nothing new to load.
   ================================================================== */

/* Brand marks, not a hand-drawn stroke set. simple-icons no longer ships a
   LinkedIn glyph (trademark), so that one and the envelope come from
   FontAwesome; two families is fine when one of them is only ever logos. */
const ICON: Record<SocialLink["id"], IconType> = {
    github: SiGithub,
    linkedin: FaLinkedinIn,
    instagram: SiInstagram,
    leetcode: SiLeetcode,
};

/* Evaluated once at build for the static page and again on the client at
   hydration. The two can only disagree for a visitor loading a stale build in
   the first seconds of January, which is what suppressHydrationWarning covers. */
const YEAR = new Date().getFullYear();

const SITE_LINKS = [...nav, ...footer.extraLinks];

/* Same split as the hero and contact. useScroll throws if its target ref is
   never attached, and hooks cannot be called conditionally, so reduced motion
   has to be a different component rather than a flag. */
export default function Footer() {
    const reduced = useReducedMotion();
    return reduced ? <StaticFooter /> : <MotionFooter />;
}

/* ------------------------------------------------------------------
   Reduced motion: the stage upright and still. The reflection stays,
   it is static. No scroll rise, no tilt, no sheen travel. The
   topography still paints, but as one held frame.
   ------------------------------------------------------------------ */
function StaticFooter() {
    return (
        <footer className={styles.footer}>
            <FooterTopo className={styles.topo} />
            <div className={styles.veil} aria-hidden="true" />
            <div className={styles.scene}>
                <div className={styles.stage}>
                    <Body />
                </div>
            </div>
        </footer>
    );
}

/* ------------------------------------------------------------------ */
function MotionFooter() {
    const ref = useRef<HTMLElement>(null);

    /* ---- scroll rise --------------------------------------------------
       0 as the footer's top enters the viewport bottom, 1 at the page's end.
       Everything settles by 0.75 so the stage is upright before the last few
       pixels of scroll rather than still moving as the page stops. */
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end end"],
    });

    /* Derived from a spring of the scroll value, NEVER from scrollYProgress
       directly. Two reasons, and the second is not obvious.

       The first is feel: the hero and contact sections run their beats off the
       same 70/28 spring, so the footer trailing the scrollbar by the same lag
       is what makes the three read as one hand.

       The second is a Framer trap. When a plain range-map of a useScroll value
       is handed to a motion element as opacity (or a lone transform), Framer
       tries to hand it to the browser's native scroll-linked animation API.
       For a target-based offset that handoff cannot attach a scroll timeline,
       so it silently falls back to a one-second time-based animation with
       fill:both, plays it once on mount, then holds the end value and stops
       writing the property. The footer sat at opacity 0 forever while the
       motion value itself read 1. A spring in the chain is not expressible as
       keyframes, so everything stays JS-driven. */
    const smooth = useSpring(scrollYProgress, { stiffness: 70, damping: 28 });
    const riseX = useTransform(smooth, [0, 0.75], [42, 0]);
    const riseY = useTransform(smooth, [0, 0.75], [140, 0]);
    const opacity = useTransform(smooth, [0, 0.5], [0, 1]);

    /* ---- pointer tilt -------------------------------------------------
       Motion values, never state: this updates on every pointer move, and a
       setState there would re-render the whole footer sixty times a second.
       Sprung so the stage has mass and settles rather than tracking the
       cursor like a rigid mirror. */
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const sx = useSpring(mx, { stiffness: 90, damping: 22 });
    const sy = useSpring(my, { stiffness: 90, damping: 22 });
    const tiltX = useTransform(sy, [-1, 1], [4, -4]);
    const tiltY = useTransform(sx, [-1, 1], [-6, 6]);

    /* The scroll rise and the pointer tilt both want rotateX. Summing them
       into one value is the only way both can drive the same axis without the
       last writer winning. */
    const rotateX = useTransform([riseX, tiltX], ([a, b]: number[]) => a + b);

    /* The highlight band's position across the letters follows the pointer, so
       the sheen moves with the tilt the way light would on a lit surface. */
    const sheenPos = useTransform(sx, [-1, 1], [0, 100]);
    const sheen = useMotionTemplate`${sheenPos}% 50%`;

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        /* No hover, no tilt. A touch screen would only ever see the stage snap
           to wherever the last tap landed and stay there. */
        if (!window.matchMedia("(hover: hover)").matches) return;

        const onMove = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            /* The footer itself is never transformed, only the stage inside it,
               so its rect is the untransformed layout box. */
            const r = el.getBoundingClientRect();
            mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
            my.set(((e.clientY - r.top) / r.height) * 2 - 1);
        };
        const onLeave = () => {
            mx.set(0);
            my.set(0);
        };

        el.addEventListener("pointermove", onMove, { passive: true });
        el.addEventListener("pointerleave", onLeave);
        return () => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerleave", onLeave);
        };
    }, [mx, my]);

    return (
        <footer ref={ref} className={styles.footer}>
            {/* Background first, then the readability veil, then the content.
                All three are siblings so the canvas never sits inside the
                perspective context and get flattened by it. */}
            <FooterTopo className={styles.topo} />
            <div className={styles.veil} aria-hidden="true" />

            {/* Opacity lives on the perspective root and NOT on the stage. An
                element with opacity below 1 is flattened by the browser, which
                on the stage would collapse its 3D layers into one plane for the
                whole fade and pop them back into depth at the end. On the scene
                it only flattens the scene's own participation in an outer 3D
                context, of which there is none, so the depth inside the stage
                is untouched and the finished picture fades as a whole. */}
            <motion.div className={styles.scene} style={{ opacity }}>
                <motion.div
                    className={styles.stage}
                    style={{ rotateX, rotateY: tiltY, y: riseY }}
                >
                    <Body sheen={sheen} />
                </motion.div>
            </motion.div>
        </footer>
    );
}

/* ------------------------------------------------------------------
   The content. Shared by both branches so the two cannot drift.
   ------------------------------------------------------------------ */
function Body({ sheen }: { sheen?: MotionValue<string> }) {
    /* Undefined under reduced motion, where Lenis is never constructed. Every
       use is optional so the links fall back to the browser's own anchor
       handling in that case. */
    const lenis = useLenis();

    /* In-page links go through Lenis so the motion matches the rest of the
       page. Real routes (/experience) fall through to Link untouched. */
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
        <>
            {/* ---- wordmark, at the greatest depth ---------------------- */}
            <div className={styles.mark}>
                <motion.p
                    className={styles.wordmark}
                    style={sheen ? { backgroundPosition: sheen } : undefined}
                >
                    {site.name}
                </motion.p>
                {/* The floor. A mirrored copy that fades and blurs away from
                    the baseline, on the same stage so it tilts with the type.
                    That is what makes the surface read as a surface. Clipped to
                    a fraction of its own height because the masked-out lower
                    half would otherwise reserve a full empty line below it. */}
                <div className={styles.floor} aria-hidden="true">
                    <p className={styles.reflection}>{site.name}</p>
                </div>
            </div>

            {/* ---- who, mid depth --------------------------------------- */}
            <div className={styles.about}>
                <p className={styles.role}>{site.role}</p>
                <p className={styles.status}>{site.status}</p>
            </div>

            {/* ---- columns, mid depth ----------------------------------- */}
            <nav className={styles.links} aria-label="Footer">
                <div className={styles.col}>
                    <h2 className={styles.colHead}>{footer.columns.explore}</h2>
                    <ul className={styles.list}>
                        {SITE_LINKS.map((item) => (
                            <li key={item.id}>
                                <Link
                                    href={item.href}
                                    className={styles.link}
                                    onClick={(e) => go(e, item.href)}
                                >
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={styles.col}>
                    <h2 className={styles.colHead}>{footer.columns.work}</h2>
                    <ul className={styles.list}>
                        {projects.map((p) => (
                            <li key={p.no}>
                                {p.repo ? (
                                    <a
                                        href={p.repo}
                                        className={styles.link}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                    >
                                        {p.title}
                                    </a>
                                ) : (
                                    <span className={styles.pending}>{p.title}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={styles.col}>
                    <h2 className={styles.colHead}>{footer.columns.connect}</h2>
                    <ul className={styles.list}>
                        {social.map((s) => {
                            const Icon = ICON[s.id];
                            /* An entry with no URL yet is listed but not
                               clickable, rather than hidden. See the note on
                               SocialLink.href in site.ts. */
                            return (
                                <li key={s.id}>
                                    {s.href ? (
                                        <a
                                            href={s.href}
                                            className={styles.link}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                        >
                                            <Icon className={styles.icon} aria-hidden="true" />
                                            {s.label}
                                        </a>
                                    ) : (
                                        <span className={styles.pending} aria-disabled="true">
                                            <Icon className={styles.icon} aria-hidden="true" />
                                            {s.label}
                                        </span>
                                    )}
                                </li>
                            );
                        })}

                        {/* The address as a row in the same list, not printed in
                            full below it. One column, one way to read it. */}
                        <li>
                            <a
                                href={`mailto:${footer.email}`}
                                className={styles.link}
                            >
                                <FaEnvelope className={styles.icon} aria-hidden="true" />
                                Email
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            {/* ---- meta, on the floor ----------------------------------- */}
            <div className={styles.meta}>
                <p className={styles.copy}>
                    &copy; <span suppressHydrationWarning>{YEAR}</span> {site.name}
                </p>

                <Link
                    href="/#top"
                    className={styles.top}
                    onClick={(e) => go(e, "/#top")}
                >
                    {footer.backToTop}
                    {/* The arrow sits in its own disc rather than naked beside
                        the label, so the control reads as one machined piece. */}
                    <span className={styles.topDisc} aria-hidden="true">
                        <svg
                            className={styles.topArrow}
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M8 12.5v-9M4.3 7.2 8 3.5l3.7 3.7" />
                        </svg>
                    </span>
                </Link>
            </div>
        </>
    );
}
