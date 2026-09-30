"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, useMotionValueEvent, useTransform } from "framer-motion";
import { projects, projectsSpread } from "@light/lib/site";
import { useBookNav } from "../BookNav";
import type { Fit } from "../fit";
import { holds, locate } from "../timeline";
import { spotAt } from "./choreography";
import styles from "./Popup.module.css";

/* ==================================================================
   POP-UP LAYER — the projects, standing up off the page.

   The DOM half of the pop-up. It decides when the 3D scene exists (only
   between the camera coming down and going back up), works out which
   project the scroll has in the spotlight, and renders everything that
   must be real HTML: the caption with the project's words and links,
   the buttons a keyboard uses to take a card out, and the hint.

   The 3D half, PopupScene, is loaded on demand: three.js, drei and the
   fonts are only fetched when the reader is nearly at the projects.
   ================================================================== */

const PopupScene = dynamic(() => import("./PopupScene"), { ssr: false });

const hold = holds.find((h) => h.spread === "popup")!;
/* Mounted early, and then kept. Getting ready takes a second or two (the
   physics engine, fonts, shaders compiling in parallel) and has to finish
   before the reader arrives, or the shaders compile on screen: measured,
   mounting on the intro spread, or halfway through About, a brisk scroll
   reached the pop-up first and the page stalled 400-800 ms as it appeared.

   So it mounts in a quiet moment: once its code is in and the page is
   idle, while nothing is being written and the book is not moving (in
   practice, on the cover). Mounting as About came to rest put its long
   frames in the middle of the pen writing About. The start of About
   remains as a fallback for a reader who scrolls on before then.

   Never unmounting means it happens once per visit, not on every pass
   (each remount also built a fresh R3F store, which is what repeated the
   THREE.Clock warning). */
const holdIndex = holds.indexOf(hold);
const warmFrom = (holds[holdIndex - 2] ?? holds[0]).from;

export default function PopupLayer({ fit, stage }: { fit: Fit; stage: { w: number; h: number } }) {
    const { progress } = useBookNav();

    const local = useTransform(progress, [hold.from, hold.to], [0, 1], { clamp: true });
    /* The cards are folded flat at both ends of the hold, so the canvas only
       has to be there while the camera is at rest in front of the book. */
    const opacity = useTransform(
        progress,
        [hold.from, hold.from + 0.002, hold.to - 0.002, hold.to],
        [0, 1, 1, 0],
    );

    const [mounted, setMounted] = useState(false);
    const [inHold, setInHold] = useState(false);
    const [spot, setSpot] = useState(-1);
    const [selected, setSelected] = useState<number | null>(null);
    const [tech, setTech] = useState<string | null>(null);

    useMotionValueEvent(progress, "change", (p) => {
        if (!mounted && p >= warmFrom) setMounted(true);
        const h = p > hold.from && p < hold.to;
        if (h !== inHold) {
            setInHold(h);
            /* Leaving the pop-up puts everything back in the book. */
            if (!h) {
                setSelected(null);
                setTech(null);
            }
        }
        const s = spotAt(local.get());
        if (s !== spot) setSpot(s);
    });

    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
        const cancel = window.cancelIdleCallback ?? window.clearTimeout;
        let gone = false;
        let id = 0;
        const quiet = () => {
            if (gone) return;
            const writing = document.querySelector("[data-pen] [data-active] [data-write]:not([data-inked])");
            const moving = locate(progress.get()).seg.kind === "motion";
            if (writing || moving) id = idle(quiet, { timeout: 1500 });
            else setMounted(true);
        };
        id = idle(
            () => {
                void import("./PopupScene").then(() => {
                    if (!gone) id = idle(quiet, { timeout: 3000 });
                });
            },
            { timeout: 5000 },
        );
        return () => {
            gone = true;
            cancel(id);
        };
    }, [progress]);

    useEffect(() => {
        if (selected === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selected]);

    if (!mounted) return null;

    const shown = selected ?? (spot >= 0 ? spot : null);
    const project = shown !== null ? projects[shown] : null;

    return (
        <div className={styles.layer} data-active={inHold || undefined} inert={!inHold}>
            <motion.div
                className={styles.scene}
                style={{ left: fit.x, top: fit.y, width: fit.w, height: fit.h, opacity }}
                aria-hidden="true"
            >
                <PopupScene
                    local={local}
                    spot={spot}
                    selected={selected}
                    tech={tech}
                    onSelect={setSelected}
                    onTech={(t) => setTech((cur) => (cur === t ? null : t))}
                    visible={inHold}
                />
            </motion.div>

            {/* A keyboard's way in: one button per card. Visually hidden, but
                focusing one shows its focus ring on the caption instead. */}
            <ul className={styles.proxies}>
                {projects.map((p, i) => (
                    <li key={p.title}>
                        <button
                            type="button"
                            onClick={() => setSelected(selected === i ? null : i)}
                            aria-pressed={selected === i}
                        >
                            {selected === i ? `${projectsSpread.close}: ${p.title}` : `Take out ${p.title}`}
                        </button>
                    </li>
                ))}
            </ul>

            {inHold && spot === -1 && selected === null && (
                <p className={styles.hint} style={{ top: Math.max(16, fit.y + fit.h * 0.08) }}>
                    {projectsSpread.hint}
                </p>
            )}

            {project && (
                <aside
                    key={project.title}
                    className={styles.caption}
                    data-selected={selected !== null || undefined}
                    style={{
                        /* On the tablecloth below the book, clear of the
                           cards and the type, left of the dock. */
                        bottom: Math.max(20, stage.h - (fit.y + fit.h) + 20),
                        left: Math.max(16, fit.x + fit.w * 0.035),
                        maxWidth: Math.min(380, stage.w * 0.32),
                    }}
                    aria-live="polite"
                >
                    <span className={styles.kind}>{project.kind}</span>
                    <h3 className={styles.title}>{project.title}</h3>
                    <p className={styles.detail}>{project.detail}</p>
                    <ul className={styles.stack} aria-label={projectsSpread.stackLabel}>
                        {project.tech.map((t) => (
                            <li key={t} data-hot={tech === t || undefined}>
                                {t}
                            </li>
                        ))}
                    </ul>
                    <div className={styles.actions}>
                        {project.repo && (
                            <a href={project.repo} target="_blank" rel="noreferrer" className={styles.repo}>
                                {projectsSpread.repoLabel}
                            </a>
                        )}
                        {selected !== null && (
                            <button type="button" className={styles.back} onClick={() => setSelected(null)}>
                                {projectsSpread.close}
                            </button>
                        )}
                    </div>
                </aside>
            )}
        </div>
    );
}
