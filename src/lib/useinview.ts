"use client";

import { useEffect, useRef, useState } from "react";

type Options = {
    /* Fraction of the element that must be visible before it counts. */
    threshold?: number;
    /* Negative bottom margin holds the trigger back until the element is
       properly on screen, rather than firing the instant it peeks in. */
    rootMargin?: string;
    /* Reveal once and stop observing. Re-animating on every scroll-by is
       both distracting and needless work. */
    once?: boolean;
};

export function useInView<T extends HTMLElement>({
    threshold = 0.15,
    rootMargin = "0px 0px -12% 0px",
    once = true,
}: Options = {}) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        /* Very old browsers, or a jsdom test env — just show the content. */
        if (typeof IntersectionObserver === "undefined") {
            setInView(true);
            return;
        }

        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    if (once) io.disconnect();
                } else if (!once) {
                    setInView(false);
                }
            },
            { threshold, rootMargin },
        );

        /* Observing fires an immediate callback with the current state, so an
           element already on screen at mount reveals without waiting. */
        io.observe(el);
        return () => io.disconnect();
    }, [threshold, rootMargin, once]);

    return { ref, inView };
}