"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLenis } from "lenis/react";
import { nav, type NavItem } from "@/lib/site";
import ThemeToggle from "./ThemeToggle";
import DockFx from "./dock/DockFx";
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
    const pathname = usePathname();
    /* The blob only tracks the one-page sections. On a sub-route such as
       /experience none of them apply, so it hides rather than lying. */
    const onHome = pathname === "/";

    /* Undefined under reduced motion, where Lenis is never constructed. Every
       use below is optional-chained so the dock falls back to the browser's
       own anchor handling in that case. */
    const lenis = useLenis();

    /* Home is active on load, per the design. */
    const [activeId, setActiveId] = useState<string>(nav[0].id);

    const navRef = useRef<HTMLElement>(null);
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

    function moveBlobTo(id: string) {
        if (id === activeId) return;

        const from = itemRefs.current[activeId];
        const to = itemRefs.current[id];
        if (from && to) setStretch(stretchFor(to.offsetLeft - from.offsetLeft));

        setActiveId(id);
        setMoveKey((k) => k + 1);
    }

    function handleClick(e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) {
        moveBlobTo(item.id);

        /* Off the home route this is a real navigation — let Link handle it and
           the browser settle on the hash once the new page renders. */
        if (!onHome) return;

        const targetId = item.href.split("#")[1];
        const target = targetId && document.getElementById(targetId);
        if (!target || !lenis) return;

        /* Already home, so there is nothing to navigate to — this is purely a
           scroll. Taking it over from the browser keeps the motion consistent
           with the rest of the page and lets Lenis honour scroll-padding. */
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0 });

        /* Keep the URL truthful without letting the browser jump to the anchor
           itself, which would fight the animation we just started. */
        window.history.replaceState(null, "", item.href);
    }

    return (
        <nav ref={navRef} className={styles.dock} aria-label="Sections">
            {/* Liquid-metal surface and travelling rim glow. Purely decorative,
                pointer-transparent, and absent entirely under reduced motion or
                without WebGL2 — the dock below is fully functional on its own. */}
            <DockFx targetRef={navRef} />

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
                        opacity: blob.ready && onHome ? 1 : 0,
                    }}
                >
                    <span
                        key={moveKey}
                        className={`${styles.blob} ${moveKey > 0 ? styles.blobMoving : ""}`}
                        style={{ "--stretch": stretch } as React.CSSProperties}
                    />
                </li>

                {nav.map((item) => {
                    const isActive = onHome && item.id === activeId;
                    return (
                        <li key={item.id}>
                            <Link
                                href={item.href}
                                ref={(el) => {
                                    itemRefs.current[item.id] = el;
                                }}
                                onClick={(e) => handleClick(e, item)}
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
                            </Link>
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