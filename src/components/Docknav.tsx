"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nav, type NavItem } from "@/lib/site";
import ThemeToggle from "./ThemeToggle";
import styles from "./Docknav.module.css";

/* Inline SVGs rather than an icon package — four icons is not worth a
   dependency, and these ship as markup with zero extra requests. */
function Icon({ name }: { name: NavItem["icon"] }) {
    const common = {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };

    switch (name) {
        case "home":
            return (
                <svg {...common}>
                    <path d="M3.5 10.4 12 3.8l8.5 6.6" />
                    <path d="M5.5 9.2v9.3a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.2" />
                    <path d="M9.75 20V14.4h4.5V20" />
                </svg>
            );
        case "about":
            return (
                <svg {...common}>
                    <circle cx="12" cy="8.2" r="3.7" />
                    <path d="M4.8 19.8a7.4 7.4 0 0 1 14.4 0" />
                </svg>
            );
        case "projects":
            return (
                <svg {...common}>
                    <path d="M3.5 7.3a1.6 1.6 0 0 1 1.6-1.6h3.6l2 2.4h7.7a1.6 1.6 0 0 1 1.6 1.6v8.4a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6Z" />
                </svg>
            );
        case "contact":
            return (
                <svg {...common}>
                    <path d="M20.2 15.2a1.7 1.7 0 0 1-1.7 1.7H8.1L4.3 20.4V6.2a1.7 1.7 0 0 1 1.7-1.7h12.5a1.7 1.7 0 0 1 1.7 1.7Z" />
                </svg>
            );
    }
}

/* How far the blob stretches, as a function of how far it has to travel.
   Capped so a jump across the whole dock doesn't smear into a line. */
function stretchFor(distancePx: number) {
    return 1 + Math.min(Math.abs(distancePx) / 300, 0.42);
}

export default function DockNav() {
    /* Home is active on load, per the design. */
    const [activeId, setActiveId] = useState<string>(nav[0].id);

    const listRef = useRef<HTMLUListElement>(null);
    const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

    const [blob, setBlob] = useState({ x: 0, w: 0, ready: false });
    /* Bumped on every move so the squash animation can restart. */
    const [moveKey, setMoveKey] = useState(0);
    const [stretch, setStretch] = useState(1);

    const measure = useCallback(() => {
        const el = itemRefs.current[activeId];
        if (!el) return;
        setBlob((prev) => {
            const next = { x: el.offsetLeft, w: el.offsetWidth, ready: true };
            /* Skip the state write when nothing actually moved — avoids a
               render loop when ResizeObserver fires on its own output. */
            if (prev.x === next.x && prev.w === next.w && prev.ready) return prev;
            return next;
        });
    }, [activeId]);

    useEffect(() => {
        measure();
    }, [measure]);

    /* Re-measure on resize and on font load, both of which can shift the
       dock's internal geometry after first paint. */
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;
        const ro = new ResizeObserver(measure);
        ro.observe(list);
        return () => ro.disconnect();
    }, [measure]);

    function handleSelect(id: string) {
        if (id === activeId) return;

        const from = itemRefs.current[activeId];
        const to = itemRefs.current[id];
        if (from && to) setStretch(stretchFor(to.offsetLeft - from.offsetLeft));

        setActiveId(id);
        setMoveKey((k) => k + 1);
    }

    return (
        <nav className={styles.dock} aria-label="Sections">
            {/* Specular highlight along the top edge — the thing that reads as
          "glass" more than the blur itself does. */}
            <span className={styles.sheen} aria-hidden="true" />

            <ul className={styles.list} ref={listRef}>
                {/* The blob. Outer node translates, inner node squashes, so the
            two motions can run on independent timing curves. */}
                <li
                    className={styles.blobTrack}
                    aria-hidden="true"
                    style={{
                        transform: `translate3d(${blob.x}px, -50%, 0)`,
                        width: blob.w || undefined,
                        opacity: blob.ready ? 1 : 0,
                    }}
                >
                    <span
                        key={moveKey}
                        className={`${styles.blob} ${moveKey > 0 ? styles.blobMoving : ""}`}
                        style={{ "--stretch": stretch } as React.CSSProperties}
                    />
                </li>

                {nav.map((item) => {
                    const isActive = item.id === activeId;
                    return (
                        <li key={item.id}>
                            <a
                                href={item.href}
                                ref={(el) => {
                                    itemRefs.current[item.id] = el;
                                }}
                                onClick={() => handleSelect(item.id)}
                                className={styles.item}
                                data-active={isActive || undefined}
                                aria-current={isActive ? "page" : undefined}
                            >
                                <span className={styles.glyph}>
                                    <Icon name={item.icon} />
                                </span>
                                {/* The tooltip is also the link's accessible name, so the
                    two can never drift apart. */}
                                <span className={styles.tip}>{item.label}</span>
                            </a>
                        </li>
                    );
                })}

                <li className={styles.sep} aria-hidden="true" />

                <li>
                    <ThemeToggle />
                </li>
            </ul>
        </nav>
    );
}