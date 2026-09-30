"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion, useMotionValueEvent, useTransform } from "framer-motion";
import { cat, endScene, type EndBlock } from "@light/lib/site";
import { useBookNav } from "../BookNav";
import { place, type Fit } from "../fit";
import { FADE, holds, locate, readingPoint, rect, spreadShowing } from "../timeline";
import { loadCat, type CatData, type Region } from "../cat/catData";
import { CatBrain } from "./catBrain";
import styles from "./End.module.css";

/* ==================================================================
   END LAYER — the last scene: the cat lying curled on the table.

   The canvas shows the scene's still (the reveal's last frame). Over the
   cat, a patch of video plays her: the waiting loops by turns (breathing,
   blinking, a glance), and when she is petted the reaction for where,
   cross-faded in from the waiting loop and back out to it. Every clip
   begins and ends in the still's pose, which is what makes the joins
   invisible (scripts/book-cat.mjs crops them all to one box).

   Where she is petted is an SVG of her parts over the frame, traced on
   the still: each is a button, so a keyboard can pet her too. The way
   back into the book is maple type on the table (EndScene).
   ================================================================== */

const EndScene = dynamic(() => import("./EndScene"), { ssr: false });

const endHold = holds.find((h) => h.spread === "end");
const contactHold = holds.find((h) => h.spread === "contact");

type End = NonNullable<CatData["end"]>;

export default function EndLayer({ fit }: { fit: Fit }) {
    const { progress, scrollToProgress } = useBookNav();
    const router = useRouter();
    const [data, setData] = useState<End | null>(null);
    const [mounted, setMounted] = useState(false);
    const [scene, setScene] = useState(false);
    const [active, setActive] = useState(false);

    const from = endHold?.from ?? 1;
    const to = endHold?.to ?? 1;
    const opacity = useTransform(progress, [from, from + (to - from) * FADE, to], [0, 1, 1]);

    /* Loaded from Contact on, so it is all there by the time she is. */
    useMotionValueEvent(progress, "change", (p) => {
        if (!mounted && contactHold && p >= contactHold.from) setMounted(true);
        const a = !!endHold && spreadShowing(endHold, p);
        if (a !== active) setActive(a);
    });

    /* Her videos and data: from Contact on, so they are in by the time she
       is, and never on the first paint. */
    /* Each video starts a decoder when it is created; eight at once held
       up a frame by 100 ms. So they are added one per idle moment. */
    const [shown, setShown] = useState(0);
    useEffect(() => {
        if (!mounted) return;
        let alive = true;
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
        void loadCat().then((d) => {
            if (!alive || !d?.end) return;
            setData(d.end);
            const total = Object.keys(d.end.clips).length;
            const more = (n: number) =>
                idle(() => {
                    if (!alive) return;
                    setShown(n);
                    if (n < total) more(n + 1);
                });
            more(1);
        });
        return () => {
            alive = false;
        };
    }, [mounted]);

    /* The blocks' 3D scene: created at a quiet moment early on (nothing
       being written, the book not moving; in practice the cover, as the
       pop-up is). Creating it at Contact put a 100+ ms frame right as the
       reader started to write. */
    useEffect(() => {
        let alive = true;
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
        const cancel = window.cancelIdleCallback ?? window.clearTimeout;
        let id = 0;
        const quiet = () => {
            if (!alive) return;
            const writing = document.querySelector("[data-pen] [data-active] [data-write]:not([data-inked])");
            const moving = locate(progress.get()).seg.kind === "motion";
            if (writing || moving) id = idle(quiet, { timeout: 1500 });
            else setScene(true);
        };
        id = idle(quiet, { timeout: 3000 });
        return () => {
            alive = false;
            cancel(id);
        };
    }, [progress]);

    /* ---- her videos ------------------------------------------------- */
    const videos = useRef(new Map<string, HTMLVideoElement>());
    const brain = useRef<CatBrain | null>(null);
    const idleAt = useRef(0);

    useEffect(() => {
        if (!data) return;
        /* One reaction at a time: starting one ends any other (the tail
           may interrupt), and each hides itself just before its end, so
           it fades back into the waiting loop underneath. */
        const hide = new Map<string, number>();
        const playClip = (name: string) => {
            const v = videos.current.get(name);
            const clip = data.clips[name];
            if (!v || !clip) return 0;
            for (const [other, el] of videos.current) {
                if (other === name || data.idle.includes(other)) continue;
                el.removeAttribute("data-on");
                el.pause();
                window.clearTimeout(hide.get(other));
            }
            window.clearTimeout(hide.get(name));
            v.currentTime = 0;
            void v.play().then(() => v.setAttribute("data-on", ""));
            hide.set(name, window.setTimeout(() => v.removeAttribute("data-on"), Math.max(0, clip.duration * 1000 - 180)));
            return clip.duration;
        };
        brain.current = new CatBrain((c) => !!data.clips[c] && !data.idle.includes(c), playClip);
    }, [data]);

    /* The waiting loops, one after another, only while she is on screen.
       Looked at again as each loop's video arrives (they come first). */
    const loopsIn = data ? Math.min(shown, data.idle.length) : 0;
    useEffect(() => {
        if (!data) return;
        const loops = data.idle.map((n) => videos.current.get(n)).filter((v): v is HTMLVideoElement => !!v);
        if (loops.length === 0) return;
        if (!active) {
            videos.current.forEach((v) => v.pause());
            return;
        }
        let i = idleAt.current % loops.length;
        const show = (k: number) => {
            const v = loops[k];
            v.currentTime = 0;
            void v.play().then(() => {
                v.setAttribute("data-on", "");
                loops.forEach((o, j) => j !== k && o.removeAttribute("data-on"));
            });
        };
        const next = () => {
            i = (i + 1) % loops.length;
            idleAt.current = i;
            show(i);
        };
        loops.forEach((v) => v.addEventListener("ended", next));
        show(i);
        return () => loops.forEach((v) => v.removeEventListener("ended", next));
    }, [data, active, loopsIn]);

    /* Arriving, she looks at the type landing; left alone, she has her
       own ideas. */
    useEffect(() => {
        if (!active || !data) return;
        const arrive = window.setTimeout(() => brain.current?.arrive(), 900);
        let wait = rand();
        const tick = window.setInterval(() => {
            const b = brain.current;
            if (!b) return;
            const now = performance.now();
            if (now - b.lastActivity > wait) {
                b.ambient(now);
                wait = rand();
            }
        }, 1000);
        return () => {
            window.clearTimeout(arrive);
            window.clearInterval(tick);
        };
    }, [active, data]);

    const pet = (region: Region) => brain.current?.pet(region);

    /* ---- the way back ----------------------------------------------- */
    const choose = (b: EndBlock) => {
        if ("href" in b) {
            router.push(b.href);
            return;
        }
        const h = holds.find((x) => x.anchor === b.anchor);
        if (h) scrollToProgress(readingPoint(h), { duration: 3 });
    };

    if (!endHold) return null;
    const patch = data ? place(fit, rect(data.box)) : null;

    return (
        <motion.div className={styles.layer} style={{ opacity }} data-active={active || undefined} inert={!active}>
            {data && patch && (
                <div className={styles.patch} style={{ left: patch.left, top: patch.top, width: patch.width, height: patch.height }} aria-hidden="true">
                    {Object.entries(data.clips)
                        /* The waiting loops first: they are what she does most. */
                        .sort(([a], [b]) => Number(data.idle.includes(b)) - Number(data.idle.includes(a)))
                        .slice(0, shown)
                        .map(([name, clip]) => (
                        <video
                            key={name}
                            ref={(el) => {
                                if (el) videos.current.set(name, el);
                                else videos.current.delete(name);
                            }}
                            className={styles.clip}
                            muted
                            playsInline
                            preload="auto"
                            poster={data.idle.includes(name) ? data.still : undefined}
                        >
                            {clip.webm && <source src={clip.webm} type="video/webm" />}
                            <source src={clip.mp4} type="video/mp4" />
                        </video>
                    ))}
                </div>
            )}

            {scene && <EndScene fit={fit} active={active} blocks={endScene.blocks} onChoose={choose} />}

            {data && (
                <svg
                    className={styles.hotspots}
                    viewBox="0 0 1280 720"
                    preserveAspectRatio="none"
                    style={{ left: fit.x, top: fit.y, width: fit.w, height: fit.h }}
                >
                    <title>{endScene.petHint}</title>
                    {(Object.entries(data.regions) as [Region, number[][]][]).map(([region, pts]) => (
                        <polygon
                            key={region}
                            points={pts.map((p) => p.join(",")).join(" ")}
                            className={styles.part}
                            role="button"
                            tabIndex={0}
                            aria-label={endScene.pet[region]}
                            onClick={() => pet(region)}
                            onKeyDown={(e: KeyboardEvent) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    pet(region);
                                }
                            }}
                        />
                    ))}
                </svg>
            )}

            {/* The type blocks for a keyboard: the same choices as buttons. */}
            <ul className={styles.proxies} aria-label="Back into the book">
                {endScene.blocks.map((b) => (
                    <li key={b.label}>
                        <button type="button" onClick={() => choose(b)}>
                            {b.label}
                        </button>
                    </li>
                ))}
            </ul>
        </motion.div>
    );
}

/* Seconds between the things she does on her own (site.ts, cat.ambient). */
function rand() {
    const [a, b] = cat.ambient;
    return (a + Math.random() * (b - a)) * 1000;
}
