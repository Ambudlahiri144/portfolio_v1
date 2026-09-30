"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { stationery, type PaperId } from "@light/lib/site";
import Guilloche from "../../Guilloche";
import { choosePaper, registerPlace, useActivePaper, useHomecoming } from "./store";
import styles from "./Stationery.module.css";

/* ==================================================================
   CHOOSER — the stationery lying on the right-hand page.

   A postcard, a sheet of letter paper and an engraved card, each a tab:
   pick one up and it goes across to the left page to be written on,
   and the one that was there comes back to its place. Pointing at a
   piece lifts it off the page and tilts it toward the pointer.
   ================================================================== */

export const DESK_ID = "writing-desk";

export default function Chooser() {
    const active = useActivePaper();
    const home = useHomecoming();
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const papers = stationery.papers;

    const onKey = (e: KeyboardEvent, i: number) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = (i + (e.key === "ArrowRight" ? 1 : -1) + papers.length) % papers.length;
        choosePaper(papers[next].id);
        refs.current[next]?.focus();
    };

    return (
        <div className={styles.chooser}>
            <p className={styles.chooserLabel} id="stationery-label">
                {stationery.chooser}
            </p>
            <div className={styles.places} role="tablist" aria-labelledby="stationery-label">
                {papers.map((p, i) => {
                    const out = p.id === active || p.id === home;
                    return (
                        <div key={p.id} className={styles.place} data-paper={p.id}>
                            <button
                                ref={(el) => {
                                    refs.current[i] = el;
                                    registerPlace(p.id, el);
                                }}
                                type="button"
                                role="tab"
                                id={`paper-tab-${p.id}`}
                                aria-selected={p.id === active}
                                aria-controls={DESK_ID}
                                tabIndex={p.id === active ? 0 : -1}
                                className={styles.thumb}
                                data-out={out || undefined}
                                onClick={() => choosePaper(p.id)}
                                onKeyDown={(e) => onKey(e, i)}
                                onPointerMove={tilt}
                                onPointerLeave={untilt}
                            >
                                <Thumb id={p.id} />
                                <span className={styles.visuallyHidden}>
                                    {p.name}, for {p.purpose}
                                </span>
                            </button>
                            <span className={styles.caption} aria-hidden="true">
                                <span className={styles.purpose}>{p.purpose}</span>
                                <span className={styles.paperName}>{out ? stationery.onDesk : p.name}</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* The tilt is written straight to the element's style: a pointer move is
   not worth a React render. */
function tilt(e: PointerEvent<HTMLElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--ty", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
}

function untilt(e: PointerEvent<HTMLElement>) {
    e.currentTarget.style.removeProperty("--tx");
    e.currentTarget.style.removeProperty("--ty");
}

/* The pieces in miniature: the same papers as on the desk, drawn small. */
function Thumb({ id }: { id: PaperId }) {
    if (id === "feedback") {
        return (
            <span className={`${styles.mini} ${styles.miniPostcard}`} aria-hidden="true">
                <span className={styles.miniLines} />
                <span className={styles.miniStamp} />
                <span className={styles.miniAddress} />
            </span>
        );
    }
    if (id === "connect") {
        return (
            <span className={`${styles.mini} ${styles.miniLetter}`} aria-hidden="true">
                <span className={styles.miniLines} />
            </span>
        );
    }
    return (
        <span className={`${styles.mini} ${styles.miniEngage}`} aria-hidden="true">
            <Guilloche preset="seal" size={30} className={styles.miniRosette} />
            <span className={`${styles.miniTitle} ${styles.foil}`} data-foil>{stationery.engagement.heading}</span>
            <span className={styles.miniLines} />
        </span>
    );
}
