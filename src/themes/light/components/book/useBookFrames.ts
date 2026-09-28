"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { BookClip } from "@light/lib/site";
import { holds, manifest, segments, type FrameRef } from "./timeline";

/* ==================================================================
   BOOK FRAMES — download everything, decode only what is near.

   The difference from the dark theme's useFrameSequence is memory. A
   decoded 1280x720 frame is 3.7 MB and the book is ~260 frames, so
   holding every frame decoded would be close to a gigabyte, far past
   what iOS allows a page. So:

   - every frame is DOWNLOADED as a compressed Blob (~7 MB for the lot)
   - only a window around the playhead is DECODED, into ImageBitmaps
     made off the main thread and closed as the reader moves on
   - the cover and the hold frame, which the reader sits on most, stay
     decoded for good

   Frames are never <img> elements. Measured: drawing <img> stand-ins
   while a bitmap decoded let the browser cache a GPU texture for every
   one it had ever drawn, and a full scrub held ~1 GB in the GPU process.
   Drawing bitmaps only bounds decoded memory by the window, nothing
   else. While the exact frame decodes, the nearest decoded frame of the
   same clip stands in — a fast scrub drops frames, it never stalls.

   Download order is coarse-to-fine: the frames the book rests on, then
   every 8th frame of every clip, then every 4th, and so on, so an early
   scroll already has something close to draw.
   ================================================================== */

const CONCURRENCY = 8;
/* New bitmaps started per animation frame, so a big jump does not queue
   dozens of decodes in one tick. */
const DECODES_PER_TICK = 3;
/* How far from the wanted frame a decoded neighbour may stand in. */
const STAND_IN = 6;
/* Frames pre-decoded at each end of the motions either side of a hold. */
const AHEAD = 8;

export type Tier = keyof typeof manifest.tiers;

/* Physical pixels, capped at 2x like the canvas. The frames top out at the
   footage's own 1280, so "lg" is simply everything that is not small. */
export function pickTier(): Tier {
    if (typeof window === "undefined") return "lg";
    const phys = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
    if (phys >= 1400) return "lg";
    if (phys >= 900) return "md";
    return "sm";
}

/* Frames kept decoded each side of the playhead. Smaller frames can afford
   a wider window. lg: 2 x 14 x 3.7 MB ≈ 100 MB. */
const WINDOW: Record<Tier, number> = { lg: 14, md: 18, sm: 24 };

export function frameUrl(clip: BookClip, frame: number, tier: Tier) {
    const n = String(frame + 1).padStart(4, "0");
    return `/book/${clip}/${tier}/${n}.webp?v=${manifest.version}`;
}

const CLIPS = Object.keys(manifest.clips) as BookClip[];

const key = (clip: BookClip, f: number) => `${clip}:${f}`;

export class FrameStore {
    private blobs = {} as Record<BookClip, (Blob | undefined)[]>;
    private bitmaps = new Map<string, ImageBitmap>();
    private pending = new Set<string>();
    private pinned = new Set<string>();
    private disposed = false;
    private readonly window: number;
    /** Which frame each bitmap is — for diagnostics. */
    readonly frameOf = new WeakMap<ImageBitmap, number>();

    constructor(readonly tier: Tier) {
        this.window = WINDOW[tier];
        for (const clip of CLIPS) this.blobs[clip] = new Array(manifest.clips[clip].count);
        /* The frames the book rests on. */
        for (const h of holds) this.pinned.add(key(h.clip, h.frame));
    }

    /* The exact frame's bitmap, else a decoded frame at most STAND_IN away
       in the same clip, else null — and null means "keep what is on the
       canvas".

       The limit matters. Unlimited, the nearest decoded frame of a clip the
       reader has only just entered was often its LAST frame, because that
       is the frame the next spread rests on and it is kept decoded. For the
       page turns that was harmless (they end where they start), but the
       tilt ends at the front of the book: the first two frames of every
       descent flashed the finished camera move. */
    drawable(ref: FrameRef): ImageBitmap | null {
        const n = this.blobs[ref.clip].length;
        for (let d = 0; d <= STAND_IN && d < n; d++) {
            const a = this.bitmaps.get(key(ref.clip, ref.frame - d));
            if (a) return a;
            if (d === 0) continue;
            const b = this.bitmaps.get(key(ref.clip, ref.frame + d));
            if (b) return b;
        }
        return null;
    }

    /* Decode the neighbourhood of the playhead, plus a short window around
       each `ahead` frame (the ends of the motions either side of a hold, so
       a turn starts on real frames rather than stand-ins). Release the rest. */
    focus(ref: FrameRef, ahead: FrameRef[] = []) {
        if (this.disposed) return;
        const windows = [
            { ref, w: this.window },
            ...ahead.map((a) => ({ ref: a, w: AHEAD })),
        ];
        const near = (clip: string, f: number) =>
            windows.some((x) => x.ref.clip === clip && Math.abs(f - x.ref.frame) <= x.w + 4);

        for (const [k, bmp] of this.bitmaps) {
            if (this.pinned.has(k)) continue;
            const [clip, f] = k.split(":");
            if (!near(clip, Number(f))) {
                bmp.close();
                this.bitmaps.delete(k);
            }
        }

        let started = 0;
        for (const { ref: r, w } of windows) {
            const n = this.blobs[r.clip].length;
            for (let d = 0; d <= w && started < DECODES_PER_TICK; d++) {
                for (const f of d === 0 ? [r.frame] : [r.frame + d, r.frame - d]) {
                    if (f >= 0 && f < n && this.decode(r.clip, f)) started++;
                }
            }
        }
    }

    arrived(ref: FrameRef, blob: Blob) {
        this.blobs[ref.clip][ref.frame] = blob;
        /* Pinned frames decode as soon as they land: they are what the page
           shows at rest, and the cover is the first thing anyone sees. */
        if (this.pinned.has(key(ref.clip, ref.frame))) this.decode(ref.clip, ref.frame);
    }

    decode(clip: BookClip, f: number) {
        const k = key(clip, f);
        const blob = this.blobs[clip][f];
        if (!blob || this.bitmaps.has(k) || this.pending.has(k)) return false;
        this.pending.add(k);
        createImageBitmap(blob)
            .then((bmp) => {
                this.pending.delete(k);
                if (this.disposed) return bmp.close();
                this.bitmaps.set(k, bmp);
                this.frameOf.set(bmp, f);
                this.onDecoded?.();
            })
            .catch(() => this.pending.delete(k));
        return true;
    }

    /* Set by the hook: the first decoded frame means the canvas can paint. */
    onDecoded?: () => void;

    /** How many frames are decoded or decoding — for diagnostics. */
    get decodedCount() {
        return this.bitmaps.size + this.pending.size;
    }

    dispose() {
        this.disposed = true;
        for (const bmp of this.bitmaps.values()) bmp.close();
        this.bitmaps.clear();
        for (const clip of CLIPS) this.blobs[clip] = [];
    }
}

/* Coarse to fine, in the order the reader meets the clips. */
function downloadOrder(): FrameRef[] {
    const seen = new Set<string>();
    const order: FrameRef[] = [];
    const push = (clip: BookClip, frame: number) => {
        const k = key(clip, frame);
        if (seen.has(k)) return;
        seen.add(k);
        order.push({ clip, frame });
    };

    for (const h of holds) push(h.clip, h.frame);

    const clipsInOrder = [...new Set(
        segments.flatMap((s) => (s.kind === "motion" ? [s.clip] : [])),
    )];
    for (const stride of [8, 4, 2, 1]) {
        for (const clip of clipsInOrder) {
            const n = manifest.clips[clip].count;
            for (let f = 0; f < n; f += stride) push(clip, f);
            push(clip, n - 1);
        }
    }
    return order;
}

export function useBookFrames(enabled = true): {
    store: RefObject<FrameStore | null>;
    /** The cover has decoded: the canvas can take over from the poster. */
    ready: boolean;
} {
    const store = useRef<FrameStore | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        const s = new FrameStore(pickTier());
        store.current = s;
        s.onDecoded = () => {
            setReady(true);
            s.onDecoded = undefined;
        };
        if (process.env.NODE_ENV !== "production") {
            (window as unknown as { __bookStore?: FrameStore }).__bookStore = s;
        }

        const queue = downloadOrder();
        const controller = new AbortController();
        let next = 0;

        const one = async (): Promise<void> => {
            while (next < queue.length && !controller.signal.aborted) {
                const ref = queue[next++];
                try {
                    const res = await fetch(frameUrl(ref.clip, ref.frame, s.tier), {
                        signal: controller.signal,
                    });
                    /* A failed frame is skipped: its neighbours stand in. */
                    if (res.ok) s.arrived(ref, await res.blob());
                } catch {
                    /* Aborted on unmount, or offline. Either way, move on. */
                }
            }
        };

        Promise.all(Array.from({ length: CONCURRENCY }, one));

        return () => {
            controller.abort();
            s.dispose();
            store.current = null;
        };
    }, [enabled]);

    return { store, ready };
}
