"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { pen as PEN } from "@light/lib/site";
import { useBookNav } from "../BookNav";
import { place, type Fit } from "../fit";
import { holds, manifest, rect, spreadShowing } from "../timeline";
import FallbackPen, { FALLBACK } from "./FallbackPen";
import { WRITING_ROT, inkAll, inkTo, inked, planWriting, unwrite, type Plan, type Pose } from "./writer";
import { following, onFollow, type Caret } from "./follow";
import { onScene } from "../sceneEvents";
import styles from "./Pen.module.css";

/* ==================================================================
   PEN LAYER — the fountain pen that writes the book.

   It lies on the tablecloth beside the book. Whenever a spread comes to
   rest, the pen is picked up and writes it (see writer.ts), then is set
   down again. Every time: once a spread has gone from the page entirely
   its ink is taken off again, so coming back to it (by scrolling, the
   dock, the ribbon) has the pen write it afresh. When the book moves (a page turn,
   the camera coming down, the close) it slides away off the right edge,
   since the footage's turning pages must never pass under a pen that is
   not in the photograph; over the pop-up it stays away.

   Sized physically: 14 cm, against the page spread's 49.2 cm. Lit like
   the photograph: the window is upper left, so its shadow falls to the
   lower right, and grows as the pen lifts.

   One rAF loop, running only while the pen moves. The reader can always
   hurry it: a click or a key on the stage, or a resize, finishes the
   page at once. Leaving mid-page just stops the pen.

   On the contact page the reader writes too: while a line of the
   stationery has focus the pen follows its caret (follow.ts), and each
   letter typed is inked in as the nib passes it.
   ================================================================== */

const G = manifest.geometry;
const SPREAD_CM = G.front.spreadCm[0];

type Sprite = { src?: string; w: number; h: number; tip: [number, number]; angle: number; length: number };

type Mode = "away" | "rest" | "writing" | "following";

export default function PenLayer({
    fit,
    stage,
    stageRef,
}: {
    fit: Fit;
    stage: { w: number; h: number };
    stageRef: RefObject<HTMLDivElement | null>;
}) {
    const { progress } = useBookNav();
    const penEl = useRef<HTMLDivElement>(null);
    const shadowEl = useRef<HTMLDivElement>(null);
    const [sprite, setSprite] = useState<Sprite>(FALLBACK);

    /* The photographed pen, if it has been made; the drawn one until then.
       pen.json is `null` until scripts/book-props.mjs writes the sprite's
       measurements into it. */
    useEffect(() => {
        let gone = false;
        fetch("/book/props/pen.json")
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                if (!gone && j) setSprite({ src: "/book/props/pen.webp", ...j });
            })
            .catch(() => {});
        return () => {
            gone = true;
        };
    }, []);

    useEffect(() => {
        const root = stageRef.current;
        const pen = penEl.current;
        const shadow = shadowEl.current;
        if (!root || !pen || !shadow || !stage.w) return;

        /* Text marked to be written is hidden only while this is here: if
           the pen never mounts, the book's text simply shows. */
        root.setAttribute("data-pen", "");

        /* ---- the room: scale, and where the pen lies ------------------ */
        const left = place(fit, rect(G.pages.left));
        const right = place(fit, rect(G.pages.right));
        const pxPerCm = (right.left + right.width - left.left) / SPREAD_CM;
        const scale = (PEN.lengthCm * pxPerCm) / sprite.length;
        const open = place(fit, rect(G.book));
        const closed = place(fit, rect(G.coverBook));

        const restFor = (spread: string | null): Pose => {
            const book = spread === "cover" || spread === "closed" ? closed : open;
            return {
                /* Clear of the book's edge and the shadow it casts, which
                   reach past its measured rect in the photograph. */
                x: Math.min(book.left + book.width + 3.4 * pxPerCm, stage.w - 1.4 * pxPerCm),
                y: book.top + book.height * 0.2,
                rot: 97,
            };
        };
        const away = (): Pose => ({ x: stage.w + 4 * pxPerCm, y: open.top + open.height * 0.4, rot: 97 });

        /* ---- drawing the pen at a pose -------------------------------- */
        const draw = (p: Pose, lift: number, t: number, onPaper: boolean) => {
            /* On the paper the hand is never quite still. */
            const tremor = onPaper ? Math.sin(t * 57) * 0.05 * pxPerCm : 0;
            const roll = onPaper ? Math.sin(t * 31) * 1.4 : 0;
            const raise = lift * 0.5 * pxPerCm;
            const s = scale * (1 + lift * 0.035);
            const body = `rotate(${p.rot + roll - sprite.angle}deg) scale(${s}) translate(${-sprite.tip[0]}px, ${-sprite.tip[1]}px)`;
            pen.style.transform = `translate(${p.x}px, ${p.y + tremor - raise}px) ${body}`;
            const d = (0.12 + lift * 0.95) * pxPerCm;
            shadow.style.transform = `translate(${p.x + d * 0.75}px, ${p.y + d}px) ${body}`;
            shadow.style.opacity = String(0.34 - lift * 0.14);
        };

        /* Brushed by the cat walking past (sceneEvents): it rolls a little
           and stays where it was pushed until next picked up. */
        const nudge = { dx: 0, rot: 0, hold: null as string | null };
        const nudged = (p: Pose, hold: string | null): Pose =>
            nudge.hold === hold ? { x: p.x + nudge.dx * pxPerCm, y: p.y, rot: p.rot + nudge.rot } : p;

        /* ---- state ---------------------------------------------------- */
        let mode: Mode = "rest";
        let pose: Pose = { ...restFor(currentHold()) };
        let target: Pose = pose;
        let plan: Plan | null = null;
        let spreadEl: Element | null = null;
        let t0 = 0;
        let seg = 0;
        let raf = 0;

        /* Following the reader's caret. `edge` is where the nib (and the
           ink) has got to on the caret's line, which trails the caret by
           the letters just typed; `goal` is the caret itself. */
        const fol = {
            el: null as HTMLElement | null,
            version: -1,
            goal: null as Caret | null,
            edge: { x: 0, top: 0 },
            typedAt: 0,
            lastT: 0,
        };
        const clearInk = (el: HTMLElement | null) => {
            if (!el) return;
            el.removeAttribute("data-inking");
            for (const v of ["--ink-x", "--ink-top", "--ink-h"]) el.style.removeProperty(v);
        };

        function currentHold() {
            const p = progress.get();
            const h = holds.find((x) => spreadShowing(x, p));
            /* Over the pop-up and the last scene the camera is not overhead,
               and a top-down pen would not belong in the picture. */
            return h && h.spread !== "popup" && h.spread !== "end" ? h.spread : null;
        }

        const finish = () => {
            if (spreadEl) inkAll(spreadEl);
            plan = null;
            spreadEl = null;
        };
        /* The reader moved on mid-page: the pen simply stops. What it had
           written fades out with the spread, and all of it is taken off
           once the spread has gone (it will be written afresh next time). */
        const abandon = () => {
            plan = null;
            spreadEl = null;
        };

        /* Spreads with ink on them. Once one has gone from the page
           entirely (past both ends of its hold, so faded right out, never
           mid-fade), its ink comes off, ready to be written again. */
        const written = new Set<HTMLElement>();
        const unwriteGone = () => {
            if (written.size === 0) return;
            const p = progress.get();
            for (const el of written) {
                if (el === spreadEl) continue;
                const h = holds.find((x) => x.spread === el.dataset.hold);
                if (h && p >= h.from && p <= h.to) continue;
                unwrite(el);
                written.delete(el);
            }
        };

        const frame = (now: number) => {
            raf = 0;
            const t = now / 1000;
            if (mode === "writing" && plan) {
                const el = (now - t0) / 1000;
                while (seg < plan.segs.length - 1 && el >= plan.segs[seg].t1) {
                    const done = plan.segs[seg];
                    if (done.kind === "write") {
                        const b = plan.blocks[done.block];
                        inkTo(b, done.line, 1);
                        if (done.line === b.lines.length - 1) inked(b.el);
                    }
                    seg++;
                }
                const s = plan.segs[seg];
                const f = Math.min(1, Math.max(0, (el - s.t0) / (s.t1 - s.t0)));
                if (s.kind === "write") {
                    const b = plan.blocks[s.block];
                    const l = b.lines[s.line];
                    if (!b.el.hasAttribute("data-wet")) b.el.setAttribute("data-wet", "");
                    inkTo(b, s.line, f);
                    pose = { x: l.mx + f * l.w, y: l.sy, rot: WRITING_ROT };
                    draw(pose, 0, t, true);
                } else {
                    const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
                    pose = {
                        x: s.from.x + (s.to.x - s.from.x) * e,
                        y: s.from.y + (s.to.y - s.from.y) * e,
                        rot: s.from.rot + (s.to.rot - s.from.rot) * e,
                    };
                    draw(pose, s.lift * Math.sin(Math.PI * f), t, false);
                }
                if (el >= plan.end) {
                    finish();
                    mode = "rest";
                    target = pose;
                    decide();
                    return;
                }
                raf = requestAnimationFrame(frame);
                return;
            }

            if (mode === "following") {
                followFrame(now, t);
                return;
            }

            /* Not writing: glide to wherever it should be. */
            const k = 0.14;
            pose = {
                x: pose.x + (target.x - pose.x) * k,
                y: pose.y + (target.y - pose.y) * k,
                rot: pose.rot + (target.rot - pose.rot) * k,
            };
            const far = Math.abs(target.x - pose.x) + Math.abs(target.y - pose.y);
            draw(pose, Math.min(1, far / (6 * pxPerCm)), t, false);
            if (far > 0.4 || Math.abs(target.rot - pose.rot) > 0.2) raf = requestAnimationFrame(frame);
            else {
                pose = target;
                draw(pose, 0, t, false);
            }
        };

        const run = () => {
            if (!raf) raf = requestAnimationFrame(frame);
        };

        /* ---- the reader writing ----------------------------------------- */
        const followFrame = (now: number, t: number) => {
            const tgt = following.target;
            if (!tgt) {
                decide();
                return;
            }
            if (tgt.el !== fol.el) {
                clearInk(fol.el);
                fol.el = tgt.el;
                fol.version = -1;
                fol.goal = null;
                fol.typedAt = now;
            }
            const el = tgt.el;

            /* Something happened in the field: where is the caret now? */
            if (following.version !== fol.version) {
                fol.version = following.version;
                const c = tgt.caret();
                if (c) {
                    const kind = following.kind;
                    const sameLine = fol.goal && Math.abs(c.top - fol.edge.top) < c.h * 0.5;
                    if (!fol.goal || kind === "focus" || kind === "paste") {
                        /* Arriving, or text that was not written by hand:
                           the nib goes straight to the caret. */
                        fol.edge = { x: c.x, top: c.top };
                    } else if (!sameLine) {
                        /* Onto a new line (the text wrapped, or Enter): the
                           nib starts it from its beginning. */
                        fol.edge = { x: kind === "type" ? c.left : c.x, top: c.top };
                    } else if (c.x < fol.edge.x || !c.atEnd) {
                        /* Letters taken away, or the caret moved back into
                           the text: nothing to ink, only to follow. */
                        fol.edge.x = c.x;
                    }
                    if (kind === "type" || kind === "delete" || kind === "focus") fol.typedAt = now;
                    fol.goal = c;
                }
            }
            const g = fol.goal;
            if (!g) return;

            /* The nib writes along to the caret at a hand's pace (a letter
               in 60-80 ms, so each one is seen to be written), faster when
               a quick typist gets ahead of it. */
            const dt = Math.min(0.05, Math.max(0, (now - fol.lastT) / 1000));
            fol.lastT = now;
            const gap = g.x - fol.edge.x;
            if (gap > 0) fol.edge.x = Math.min(g.x, fol.edge.x + (110 + gap * 6) * dt);
            const writingNow = gap > 0.5 || now - fol.typedAt < 240;

            /* Letters the nib has not reached yet stay hidden. */
            if (tgt.ink && g.atEnd && gap > 0.5) {
                el.setAttribute("data-inking", "");
                el.style.setProperty("--ink-x", `${fol.edge.x.toFixed(1)}px`);
                el.style.setProperty("--ink-top", `${Math.max(0, g.top).toFixed(1)}px`);
                el.style.setProperty("--ink-h", `${(g.h * 0.84).toFixed(1)}px`);
            } else {
                clearInk(el);
            }

            const r = el.getBoundingClientRect();
            const sr = root!.getBoundingClientRect();
            const nib: Pose = { x: r.left - sr.left + fol.edge.x, y: r.top - sr.top + g.top + g.h * 0.8, rot: WRITING_ROT };
            const far = Math.hypot(nib.x - pose.x, nib.y - pose.y);
            const travelling = far > 1.2 * pxPerCm;
            const k = travelling ? 0.2 : 0.6;
            pose = {
                x: pose.x + (nib.x - pose.x) * k,
                y: pose.y + (nib.y - pose.y) * k,
                rot: pose.rot + (nib.rot - pose.rot) * k,
            };
            /* Lifted on its way to the line; on the paper while writing; a
               little off it when the reader pauses to think. */
            const idle = now - fol.typedAt;
            const lift = travelling
                ? Math.min(1, far / (6 * pxPerCm))
                : writingNow
                  ? 0
                  : Math.min(0.28, Math.max(0, (idle - 900) / 2500));
            draw(pose, lift, t, !travelling && writingNow);

            const settled = !travelling && far < 0.3 && gap <= 0.5 && !writingNow && lift >= 0.28;
            if (!settled) raf = requestAnimationFrame(frame);
        };

        /* ---- what the pen should be doing now ------------------------- */
        function decide() {
            unwriteGone();
            const hold = currentHold();
            const writingHere = mode === "writing" && spreadEl?.getAttribute("data-hold") === hold;
            if (mode === "writing" && !writingHere) {
                abandon();
                mode = "rest";
            }
            if (!hold) {
                mode = "away";
                target = away();
                run();
                return;
            }
            if (writingHere) return;
            const el = root!.querySelector<HTMLElement>(`[data-hold="${hold}"]`);

            /* The reader is writing on this spread: go to them. */
            const tgt = following.target;
            if (tgt && el && el.contains(tgt.el)) {
                if (mode !== "following") fol.typedAt = performance.now();
                mode = "following";
                run();
                return;
            }
            if (mode === "following") {
                clearInk(fol.el);
                fol.el = null;
            }
            if (el && el.querySelector("[data-write]:not([data-inked])")) {
                const next = planWriting(el, root!.getBoundingClientRect(), pose, restFor(hold));
                if (next) {
                    plan = next;
                    spreadEl = el;
                    written.add(el);
                    nudge.hold = null;
                    mode = "writing";
                    t0 = performance.now();
                    seg = 0;
                    run();
                    return;
                }
            }
            mode = "rest";
            target = nudged(restFor(hold), hold);
            run();
        }

        const unsubscribe = progress.on("change", decide);
        const unnudge = onScene("penNudge", (e) => {
            const hold = currentHold();
            if (mode !== "rest" || !hold) return;
            nudge.hold = hold;
            nudge.dx += e.dx;
            nudge.rot += e.rot;
            target = nudged(restFor(hold), hold);
            run();
        });
        const unfollow = onFollow(() => {
            if (mode === "following") run();
            else decide();
        });
        /* "Just show me": any press on the book finishes the page. */
        const hurry = () => {
            if (mode !== "writing") return;
            finish();
            mode = "rest";
            decide();
        };
        root.addEventListener("pointerdown", hurry);
        window.addEventListener("keydown", hurry);

        draw(pose, 0, 0, false);
        /* Measure only once the book's type has loaded, or the lines would
           be measured in a fallback face. */
        let alive = true;
        void document.fonts.ready.then(() => alive && decide());

        return () => {
            alive = false;
            cancelAnimationFrame(raf);
            unsubscribe();
            unfollow();
            unnudge();
            clearInk(fol.el);
            root.removeEventListener("pointerdown", hurry);
            window.removeEventListener("keydown", hurry);
            /* A resize (the effect re-runs with the new fit) or unmount
               mid-page: the page is written, rather than left half-masked. */
            finish();
            root.removeAttribute("data-pen");
        };
    }, [fit, stage.w, stage.h, sprite, progress, stageRef]);

    return (
        <div className={styles.layer} aria-hidden="true">
            <div ref={shadowEl} className={styles.shadow}>
                <Art sprite={sprite} />
            </div>
            <div ref={penEl} className={styles.pen}>
                <Art sprite={sprite} />
            </div>
        </div>
    );
}

function Art({ sprite }: { sprite: Sprite }) {
    if (!sprite.src) return <FallbackPen />;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={sprite.src} width={sprite.w} height={sprite.h} alt="" draggable={false} />;
}
