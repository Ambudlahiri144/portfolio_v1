"use client";

import { useEffect, useRef, useState } from "react";
import { cat } from "@light/lib/site";
import { useBookNav } from "../BookNav";
import { place, type Fit } from "../fit";
import { onFollow, following } from "../pen/follow";
import { emitScene } from "../sceneEvents";
import { holds, rect, spreadShowing } from "../timeline";
import { catOverride, freshUrl, loadCat, type OverlayClip } from "./catData";
import styles from "./Cat.module.css";

/* ==================================================================
   CAT LAYER — the cat passing through the overhead pages.

     walk   on About, once the pen has written the page, she walks past
            along the right-hand edge, brushing the resting pen and the
            ribbon as she goes
     peek   on Contact, she looks over the top-right corner, when the
            reader starts writing (to watch the pen) or a few seconds
            after the page is written

   Always the first time a page is reached on a visit, then now and then
   (cat.again). Each clip was filmed on the book's own overhead rest
   frame and cut out against it (scripts/book-cat.mjs), so it is placed
   with the canvas's fit and lands exactly where it was filmed, shadow
   and all. Above the page text and the pen; below the ribbon and dock.
   ================================================================== */

type Kind = "walk" | "peek";
type Showing = { kind: Kind; id: number; url: string; box: number[]; leaving: boolean };

/* Kinds already seen this visit. */
const seen = new Set<Kind>();

function decides(kind: Kind) {
    const o = catOverride();
    if (o) return o === "always";
    if (!seen.has(kind)) return true;
    return Math.random() < cat.again;
}

const written = (spread: string) => {
    const el = document.querySelector(`[data-hold="${spread}"]`);
    return !!el && !el.querySelector("[data-write]:not([data-inked])");
};

export default function CatLayer({ fit }: { fit: Fit }) {
    const { progress } = useBookNav();
    const [show, setShow] = useState<Showing | null>(null);
    const showRef = useRef<Showing | null>(null);
    useEffect(() => {
        showRef.current = show;
    });

    useEffect(() => {
        let alive = true;
        let clips: { walk?: OverlayClip; peek?: OverlayClip } = {};
        let here: string | null = null;
        /* Whether this arrival gets the cat, and the timers once it does. */
        let pending: Kind | null = null;
        let writtenAt = 0;
        let timers: number[] = [];
        let seq = 0;
        const clear = () => {
            timers.forEach((t) => window.clearTimeout(t));
            timers = [];
        };

        const play = async (kind: Kind) => {
            const clip = clips[kind];
            pending = null;
            if (!clip) return;
            seen.add(kind);
            const url = await freshUrl(clip.src);
            /* Decoded before it is shown: a big animated image decoding as
               it appears held up a frame for 100 ms or more. */
            if (url) {
                const probe = new Image();
                probe.src = url;
                await probe.decode().catch(() => {});
            }
            if (!alive || !url || here !== (kind === "walk" ? cat.walk.spread : cat.peek.spread)) {
                if (url) URL.revokeObjectURL(url);
                return;
            }
            const id = ++seq;
            setShow({ kind, id, url, box: clip.box, leaving: false });
            for (const c of clip.cues) {
                timers.push(
                    window.setTimeout(() => {
                        if (c.event === "penNudge") emitScene("penNudge", { dx: c.dx, rot: c.rot });
                        else emitScene("gust", { cord: c.cord, strength: c.strength });
                    }, c.t * 1000),
                );
            }
            timers.push(
                window.setTimeout(() => {
                    setShow((s) => (s && s.id === id ? null : s));
                    URL.revokeObjectURL(url);
                }, clip.duration * 1000 + 100),
            );
        };

        /* The page left mid-clip: the camera is going, so is she. */
        const leave = () => {
            clear();
            pending = null;
            const s = showRef.current;
            if (!s) return;
            setShow({ ...s, leaving: true });
            window.setTimeout(() => {
                setShow((x) => (x && x.id === s.id ? null : x));
                URL.revokeObjectURL(s.url);
            }, 260);
        };

        const check = () => {
            const p = progress.get();
            const h = holds.find((x) => spreadShowing(x, p));
            const now = h ? h.spread : null;
            if (now !== here) {
                if (showRef.current || pending) leave();
                here = now;
                writtenAt = 0;
                if (now === cat.walk.spread && clips.walk && decides("walk")) pending = "walk";
                else if (now === cat.peek.spread && clips.peek && decides("peek")) pending = "peek";
            }
            if (!pending || !here) return;
            if (!written(here)) {
                writtenAt = 0;
                return;
            }
            if (!writtenAt) {
                writtenAt = performance.now();
                const kind = pending;
                const delay = (kind === "walk" ? cat.walk.delay : cat.peek.delay) * 1000;
                timers.push(window.setTimeout(() => pending === kind && play(kind), delay));
            }
        };

        /* The reader started writing on the peek's page: she comes to look. */
        const offFollow = onFollow(() => {
            if (pending !== "peek" || !writtenAt) return;
            const el = document.querySelector(`[data-hold="${cat.peek.spread}"]`);
            if (following.target && el?.contains(following.target.el)) void play("peek");
        });

        void loadCat().then((d) => {
            if (!alive || !d) return;
            clips = { walk: d.walk, peek: d.peek };
            /* Fetched and decoded while nothing much is happening, so the
               first showing does not wait on the network. */
            const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
            idle(() => {
                for (const c of [d.walk, d.peek]) if (c) void freshUrl(c.src).then((u) => u && URL.revokeObjectURL(u));
            });
            here = null;
            check();
        });

        const unsubscribe = progress.on("change", check);
        /* The pen finishing a page changes no scroll position: look again. */
        const tick = window.setInterval(check, 250);

        return () => {
            alive = false;
            clear();
            unsubscribe();
            offFollow();
            window.clearInterval(tick);
        };
    }, [progress]);

    if (!show) return null;
    const box = place(fit, rect(show.box));
    return (
        <div className={styles.layer} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                key={show.id}
                className={styles.clip}
                data-leaving={show.leaving || undefined}
                src={show.url}
                alt=""
                draggable={false}
                style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
        </div>
    );
}
