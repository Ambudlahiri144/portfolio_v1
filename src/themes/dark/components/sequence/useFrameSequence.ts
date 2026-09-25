"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/* ==================================================================
   FRAME SEQUENCE PRELOADER

   Shared by the hero and the contact section. Both scrub a WebP frame
   sequence on a canvas, and the loading half of that job has enough
   sharp edges in it that a second copy would drift from this one
   within a change or two.
   ================================================================== */

/* How many frames are in flight at once.

   Firing the whole set at once is fine over HTTP/2 but stampedes the dev server
   on HTTP/1.1, and it makes the progress bar jump rather than fill. A modest
   window keeps both honest. */
const CONCURRENCY = 12;

/* The small set is picked on physical pixels, not CSS width — a 390pt phone at
   3x is asking for more detail than a 900px laptop window. The threshold sits
   just above a typical phone's device width so handsets take the small set. */
export function wantsSmallSet() {
    if (typeof window === "undefined") return false;
    return window.innerWidth * (window.devicePixelRatio || 1) < 1400;
}

export type FrameSequence = {
    /* Read by the paint loop every frame. A ref, not state — this array is
       mutated as images arrive and must never trigger a re-render. */
    imagesRef: RefObject<HTMLImageElement[]>;
    /** 0..1 fraction of the set that has finished loading. */
    progress: number;
    /** True once every frame has resolved, successfully or not. */
    ready: boolean;
};

export function useFrameSequence({
    count,
    path,
    enabled = true,
}: {
    count: number;
    /** Builds the URL for frame `i` (0-based) at the requested size. */
    path: (i: number, small: boolean) => string;
    /**
     * Gate the download.
     *
     * The hero is above the fold and passes true, so it starts immediately.
     * The contact section is several viewports down and waits until it is
     * nearly on screen — otherwise its set competes with the hero's for
     * bandwidth at page load, and most of it would be wasted on anyone who
     * never scrolls that far.
     */
    enabled?: boolean;
}): FrameSequence {
    const imagesRef = useRef<HTMLImageElement[]>([]);
    const [progress, setProgress] = useState(0);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        const small = wantsSmallSet();
        const images: HTMLImageElement[] = new Array(count);
        imagesRef.current = images;

        let loaded = 0;
        let next = 0;

        const startOne = (): Promise<void> => {
            const i = next++;
            if (i >= count) return Promise.resolve();
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.decoding = "async";
                /* Resolve on error too. One missing frame should degrade to a
                   held previous frame, never a permanently stuck loader. */
                const done = () => {
                    loaded += 1;
                    if (!cancelled) setProgress(loaded / count);
                    resolve();
                };
                img.onload = done;
                img.onerror = done;
                img.src = path(i, small);
                images[i] = img;
            }).then(() => (next < count ? startOne() : undefined));
        };

        Promise.all(Array.from({ length: CONCURRENCY }, startOne)).then(() => {
            if (!cancelled) setReady(true);
        });

        return () => {
            cancelled = true;
            /* Drop the decoded bitmaps rather than waiting for GC to notice —
               a full-resolution set is a lot of memory to leave hanging on a
               route change. */
            for (const img of images) {
                if (img) {
                    img.onload = null;
                    img.onerror = null;
                    img.src = "";
                }
            }
            imagesRef.current = [];
        };
        /* `path` is deliberately not a dependency. Callers define it as a module
           -level function or an inline closure; depending on it would restart the
           whole download on every render for the inline case. count and enabled
           are the only things that actually change what gets fetched. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count, enabled]);

    return { imagesRef, progress, ready };
}
