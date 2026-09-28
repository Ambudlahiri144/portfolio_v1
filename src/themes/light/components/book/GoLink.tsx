"use client";

import type { MouseEvent, ReactNode } from "react";
import { useLenis } from "lenis/react";

/* An in-page link that travels through Lenis, so jumping between spreads
   plays the page turns in between rather than cutting. Without Lenis
   (reduced motion) it is a plain anchor and the browser jumps. */
export default function GoLink({
    to,
    className,
    children,
}: {
    to: string;
    className?: string;
    children: ReactNode;
}) {
    const lenis = useLenis();

    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
        const target = document.getElementById(to);
        if (!lenis || !target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0, duration: 2.2 });
        window.history.replaceState(null, "", `/#${to}`);
    };

    return (
        <a href={`/#${to}`} className={className} onClick={onClick}>
            {children}
        </a>
    );
}
