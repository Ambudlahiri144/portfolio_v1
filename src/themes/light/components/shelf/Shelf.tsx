"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { tech } from "@light/lib/site";
import { useReducedMotion } from "@light/lib/useReducedMotion";
import Guilloche from "../Guilloche";
import { volumes, type Volume } from "./volumes";
import styles from "./Shelf.module.css";

/* ==================================================================
   SHELF — /experience as a bookshelf.

   The DOM half. It mounts the 3D shelf, gives the keyboard a real list of
   the volumes (arrow keys move, Enter opens, Esc puts back), and renders
   the open volume's page as real text, placed each frame by ShelfScene
   over the 3D page it belongs to.

   Reduced motion and narrow screens get the same entries as paper
   sheets, with no canvas at all.
   ================================================================== */

const ShelfScene = dynamic(() => import("./ShelfScene"), { ssr: false });

function subscribeNarrow(cb: () => void) {
    const mq = window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)");
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
}
const getNarrow = () => window.matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)").matches;

export default function Shelf() {
    const reduced = useReducedMotion();
    const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, () => false);
    return reduced || narrow ? <PaperRecord /> : <ShelfStage />;
}

function ShelfStage() {
    const [selected, setSelected] = useState<number | null>(null);
    const [hovered, setHovered] = useState<number | null>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => {
        if (selected === null) return;
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selected]);

    const onListKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = (i + (e.key === "ArrowRight" ? 1 : -1) + volumes.length) % volumes.length;
        buttons.current[next]?.focus();
    };

    const open = selected !== null ? volumes[selected] : null;

    return (
        <div className={styles.stage}>
            <div className={styles.canvas} aria-hidden="true">
                <ShelfScene
                    selected={selected}
                    hovered={hovered}
                    onHover={setHovered}
                    onSelect={setSelected}
                    pageRef={pageRef}
                />
            </div>

            <p className={styles.hint} aria-hidden="true">
                {open ? "Esc, or click outside, to put it back." : "Take a volume down."}
            </p>

            {/* The keyboard's shelf: the same volumes, in order. */}
            <ul className={styles.proxies} aria-label="Volumes">
                {volumes.map((v, i) => (
                    <li key={v.id}>
                        <button
                            type="button"
                            ref={(el) => {
                                buttons.current[i] = el;
                            }}
                            aria-pressed={selected === i}
                            onFocus={() => setHovered(i)}
                            onBlur={() => setHovered(null)}
                            onKeyDown={(e) => onListKey(e, i)}
                            onClick={() => setSelected(selected === i ? null : i)}
                        >
                            {v.spine}, {v.period}
                        </button>
                    </li>
                ))}
            </ul>

            {/* The open volume's first page. Positioned by ShelfScene. */}
            <div
                ref={pageRef}
                className={styles.page}
                hidden={!open}
                aria-live="polite"
                role="region"
                aria-label={open ? `${open.spine}: the open page` : undefined}
            >
                {open && <PageContent volume={open} onClose={() => setSelected(null)} />}
            </div>
        </div>
    );
}

function PageContent({ volume, onClose }: { volume: Volume; onClose?: () => void }) {
    const e = volume.entry;
    return (
        <div className={styles.pageInner}>
            <span className={styles.period}>{volume.period}</span>
            {e ? (
                <>
                    <h2 className={styles.pageTitle}>{e.title}</h2>
                    <p className={styles.org}>{e.org}</p>
                    {e.detail && <p className={styles.detail}>{e.detail}</p>}
                    {volume.kind === "education" && e.detail && (
                        <Guilloche preset="seal" size={76} className={styles.seal} />
                    )}
                    {e.tech.length > 0 && (
                        <ul className={styles.stack} aria-label="Built with">
                            {e.tech.map((id) => (
                                <li key={id}>{tech.find((t) => t.id === id)?.label ?? id}</li>
                            ))}
                        </ul>
                    )}
                </>
            ) : (
                <>
                    <h2 className={styles.pageTitle}>{volume.spine}</h2>
                    <ul className={styles.stackAll}>
                        {tech.map((t) => (
                            <li key={t.id}>{t.label}</li>
                        ))}
                    </ul>
                </>
            )}
            {onClose && (
                <button type="button" className={styles.close} onClick={onClose}>
                    Put it back
                </button>
            )}
        </div>
    );
}

/* No canvas: the record as sheets of paper. */
function PaperRecord() {
    return (
        <div className={styles.paper}>
            {volumes.map((v) => (
                <section key={v.id} className={styles.sheet} aria-label={v.spine}>
                    <PageContent volume={v} />
                </section>
            ))}
        </div>
    );
}
