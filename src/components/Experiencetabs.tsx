"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { TimelineEntry, TechId } from "@/lib/site";
import TechGlobe from "./Techglobe";
import styles from "./Experiencetabs.module.css";

/* Timing for the travelling spine, in seconds.
   SEG  — how long one segment takes to draw between two nodes.
   GAP  — the pause at each node before the line moves on. This is the
          beat that makes it read as "pointing at" each entry. */
const SEG = 0.46;
const GAP = 0.22;
const LEAD = 0.12;

type TabId = "work" | "education";

const TABS: { id: TabId; label: string }[] = [
    { id: "work", label: "Work" },
    { id: "education", label: "Academic" },
];

function Timeline({
    entries,
    selected,
    onSelect,
}: {
    entries: TimelineEntry[];
    selected: number;
    onSelect: (i: number) => void;
}) {
    return (
        <ol className={styles.list}>
            {entries.map((entry, i) => {
                const t = LEAD + i * (SEG + GAP);
                return (
                    <li
                        key={i}
                        className={styles.entry}
                        style={
                            {
                                "--node-d": `${t.toFixed(3)}s`,
                                "--seg-d": `${(t + GAP).toFixed(3)}s`,
                                "--copy-d": `${(t + 0.1).toFixed(3)}s`,
                                "--seg-t": `${SEG}s`,
                            } as CSSProperties
                        }
                    >
                        {/* Each entry owns the piece of spine below its own node, so
                the line advances one entry at a time regardless of how
                many there are. The last one is hidden in CSS, which is
                what makes the line stop at the final node. */}
                        <span className={styles.segment} aria-hidden="true" />
                        <span className={styles.node} aria-hidden="true" />

                        <div className={styles.copy}>
                            {/* The whole entry is the control — clicking it lights up
                  that stack on the globe. */}
                            <button
                                type="button"
                                className={styles.card}
                                aria-pressed={selected === i}
                                onClick={() => onSelect(i)}
                            >
                                <p className={styles.period}>{entry.period}</p>
                                <h3 className={styles.role}>{entry.title}</h3>
                                <p className={styles.org}>{entry.org}</p>
                                <p className={styles.detail}>{entry.detail}</p>
                            </button>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

export default function ExperienceTabs({
    work,
    education,
}: {
    work: TimelineEntry[];
    education: TimelineEntry[];
}) {
    /* Work is the default view. */
    const [tab, setTab] = useState<TabId>("work");
    const [moves, setMoves] = useState(0);
    /* First entry is lit on load so the globe means something immediately. */
    const [selected, setSelected] = useState(0);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const index = TABS.findIndex((t) => t.id === tab);
    const entries = tab === "work" ? work : education;

    function select(next: TabId) {
        if (next === tab) return;
        setTab(next);
        setMoves((m) => m + 1);
        /* The old index may not exist in the new list. */
        setSelected(0);
    }

    /* Arrow keys move between tabs, which is what the tablist pattern
       expects and what keyboard users will try. */
    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = (index + dir + TABS.length) % TABS.length;
        select(TABS[next].id);
        tabRefs.current[next]?.focus();
    }

    const activeTech: TechId[] = entries[selected]?.tech ?? [];

    return (
        <div className={styles.layout}>
            <div className={styles.wrap}>
                <div
                    className={styles.tabs}
                    role="tablist"
                    aria-label="Experience type"
                    onKeyDown={onKeyDown}
                    style={{ "--i": index } as CSSProperties}
                >
                    {/* Same sliding-and-squashing indicator as the dock, so the two
            controls feel like they belong to the same product. */}
                    <span className={styles.indicator} aria-hidden="true">
                        <span
                            key={moves}
                            className={`${styles.blob} ${moves > 0 ? styles.blobMoving : ""}`}
                        />
                    </span>

                    {TABS.map((t, i) => (
                        <button
                            key={t.id}
                            ref={(el) => {
                                tabRefs.current[i] = el;
                            }}
                            type="button"
                            role="tab"
                            id={`tab-${t.id}`}
                            aria-selected={tab === t.id}
                            aria-controls={`panel-${t.id}`}
                            tabIndex={tab === t.id ? 0 : -1}
                            className={styles.tab}
                            onClick={() => select(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Keyed on the tab so switching remounts the list and the spine
          animation replays from the top rather than sitting finished. */}
                <div
                    key={tab}
                    role="tabpanel"
                    id={`panel-${tab}`}
                    aria-labelledby={`tab-${tab}`}
                    className={styles.panel}
                >
                    <Timeline
                        entries={entries}
                        selected={selected}
                        onSelect={setSelected}
                    />
                </div>
            </div>

            {/* Sticky so it stays in view while the timeline scrolls past. */}
            <aside className={styles.globeCol}>
                <div className={styles.globeSticky}>
                    <TechGlobe active={activeTech} />
                </div>
            </aside>
        </div>
    );
}