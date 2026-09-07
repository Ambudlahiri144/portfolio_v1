"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Theme } from "@/lib/useTheme";

/* ==================================================================
   FRAME SEQUENCE PRELOADER

   Shared by every scrubbed section. Each one exists twice, once per
   world: the mountain path in the morning, and Tokyo at night. The
   theme is not a colour scheme any more, it is which place you are in,
   so the frames themselves differ and this has to hold both.

   It keeps one cache per world. The active world loads first and is the
   only one that reports progress; the other follows once that has
   finished, so a visitor who flips the theme mid-scroll finds the
   frames already there. The swap happens only when the incoming set is
   complete, which is what stops the toggle showing a half-loaded place.

   This is a deliberate return to how the file worked before. It
   collapsed to a single cache when the footage was a woodblock print,
   because pigment on paper is the same at any hour. Once the footage
   became a place with weather in it, that stopped being true.
   ================================================================== */

/* How many frames are in flight at once.

   Firing the whole set at once is fine over HTTP/2 but stampedes the dev
   server on HTTP/1.1, and it makes the progress bar jump rather than fill. A
   modest window keeps both honest. */
const CONCURRENCY = 12;

/* The small set is picked on physical pixels, not CSS width — a 390pt phone at
   3x is asking for more detail than a 900px laptop window. The threshold sits
   just above a typical phone's device width so handsets take the small set. */
export function wantsSmallSet() {
    if (typeof window === "undefined") return false;
    return window.innerWidth * (window.devicePixelRatio || 1) < 1400;
}

/* The key a set is cached under. A sequence that differs by world is held
   twice; one that does not, like the avatar print, is held once under
   "shared" rather than duplicated into two identical caches. */
type Key = Theme | "shared";

type Cache = {
    images: HTMLImageElement[];
    complete: boolean;
    promise: Promise<Cache>;
};

export type FrameSequence = {
    /* Read by the paint loop every frame. A ref, not state — this array is
       swapped when a world's set completes and must never trigger a render
       on its own. */
    imagesRef: RefObject<HTMLImageElement[]>;
    /** 0..1 fraction of the FIRST world's set that has finished loading. */
    progress: number;
    /** True once a world is complete and showing. */
    ready: boolean;
    /** Bumped on every swap, so the canvas repaints even if scroll has not moved. */
    revision: number;
};

export function useFrameSequence({
    count,
    path,
    theme,
    enabled = true,
}: {
    count: number;
    /** Builds the URL for frame `i` (0-based) at the requested size and world. */
    path: (i: number, small: boolean, theme: Theme) => string;
    /**
     * Which world this sequence belongs to, when it belongs to one.
     *
     * Omit it for footage that is the same in both, which is any sequence of a
     * thing rather than of a place: the avatar is a print of a person and does
     * not acquire weather. Omitting it also halves the memory, because there is
     * then one cache instead of two holding identical bitmaps.
     */
    theme?: Theme;
    /**
     * Gate the download. Sections below the fold wait until they are nearly
     * on screen, so their frames never compete with the hero's for the one
     * moment the hero is being watched.
     */
    enabled?: boolean;
}): FrameSequence {
    const imagesRef = useRef<HTMLImageElement[]>([]);
    const caches = useRef<Partial<Record<Key, Cache>>>({});
    const alive = useRef(true);

    const [progress, setProgress] = useState(0);
    const [ready, setReady] = useState(false);
    const [revision, setRevision] = useState(0);

    /* Starts, or returns the in-flight load of, one world's set. Safe to call
       any number of times; a world is fetched at most once per mount. */
    const load = useCallback(
        (t: Key, report: boolean): Promise<Cache> => {
            const existing = caches.current[t];
            if (existing) return existing.promise;

            const small = wantsSmallSet();
            const images: HTMLImageElement[] = new Array(count);
            let loaded = 0;
            let next = 0;

            const startOne = (): Promise<void> => {
                const i = next++;
                if (i >= count) return Promise.resolve();
                return new Promise<void>((resolve) => {
                    const img = new Image();
                    img.decoding = "async";
                    /* Resolve on error too. One missing frame should degrade to
                       a held previous frame, never a permanently stuck loader. */
                    const done = () => {
                        loaded += 1;
                        if (report && alive.current) setProgress(loaded / count);
                        resolve();
                    };
                    img.onload = done;
                    img.onerror = done;
                    img.src = path(i, small, t === "shared" ? "light" : t);
                    images[i] = img;
                }).then(() => (next < count ? startOne() : undefined));
            };

            const cache: Cache = {
                images,
                complete: false,
                promise: Promise.all(Array.from({ length: CONCURRENCY }, startOne)).then(() => {
                    cache.complete = true;
                    return cache;
                }),
            };
            caches.current[t] = cache;
            return cache.promise;
        },
        [count, path],
    );

    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            for (const c of Object.values(caches.current)) {
                for (const img of c.images) {
                    if (img) {
                        img.onload = null;
                        img.onerror = null;
                        img.src = "";
                    }
                }
            }
            /* The caches go with the images. Refs survive React's
               development-only unmount and remount of effects, and a cache
               whose loads were just cancelled holds a promise that can never
               settle: the remount would dedupe onto it and sit at 0% for ever. */
            caches.current = {};
            imagesRef.current = [];
        };
    }, []);

    useEffect(() => {
        if (!enabled) return;
        let stale = false;
        const key: Key = theme ?? "shared";
        /* Nothing to prefetch for a theme-neutral sequence: there is no other
           world for it to be in. */
        const other: Key | null =
            theme === undefined ? null : theme === "dark" ? "light" : "dark";

        const activate = (c: Cache) => {
            if (stale || !alive.current) return;
            if (imagesRef.current === c.images) return;
            imagesRef.current = c.images;
            setReady(true);
            setRevision((r) => r + 1);
        };

        const current = caches.current[key];
        if (current?.complete) {
            /* Toggled into a world that has already arrived: swap now, no gap. */
            activate(current);
            if (other) void load(other, false);
            return () => {
                stale = true;
            };
        }

        /* First load, or a toggle into a world still in flight. Progress is
           reported only for the very first set; on a toggle the world you are
           already standing in keeps painting until the new one is complete,
           which is the whole point of holding two. */
        void load(key, !ready).then((c) => {
            activate(c);
            if (other && alive.current) void load(other, false);
        });

        return () => {
            stale = true;
        };
        /* `ready` is read for the report flag only; re-running on its change
           would restart nothing (load dedupes) but is pointless work. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme, enabled, load]);

    return { imagesRef, progress, ready, revision };
}
