"use client";

import { useLayoutEffect, useRef } from "react";
import type { Mode } from "./ContactForm";
import styles from "./ChoiceWalls.module.css";

/* ==================================================================
   THE THREE WALLS

   The black void around the phone is read as a room: a left wall and a
   right wall running down either side of the marble runway, and a back
   wall behind the phone. Each carries one word — first "Choose / A /
   Mode", then "Feedback / Connect / Hire me!" in the same places. The
   options are real buttons.

   THE WORDS STAND ON THE FLOOR LINES. The side walls are vertical planes
   running exactly along the runway's two edges, and each word sits on
   its wall with its baseline on the edge of the marble — so it rises
   from the bottom corner toward the pedestal at the floor's own angle,
   and shrinks exactly as the tiles do: large at the front of the frame,
   small where the phone stands.

   TRUE PERSPECTIVE, ON PURPOSE. Along a line that runs to a vanishing
   point, size is proportional to the distance left to that point. A word
   that covers the floor edge from the corner nearly to the pedestal must
   therefore end much smaller than it starts — the letters at the far end
   are a fifth of the size of those at the front, the same ratio the
   tiles show. That was the choice over keeping a 60px minimum, which
   would have confined each word to the outer third of the floor.

   THE FLOOR IS MEASURED, NOT GUESSED. Fitting lines to the runway's lit
   edges on frames 18 and 45 — the frames the choice is made over — puts
   the vanishing point at (641, 338) of the 1280x720 frame and has the
   edges meet the frame's bottom at x 91 and 1219. A camera moving
   straight down a straight runway sees those edges as the same two lines
   throughout, so the words stay on them as the frames scrub. The points
   are mapped to the screen through the same cover-fit the canvas uses.

   FLOOR TO TOP, EDGE TO EDGE — THEN LIFTED. Each side word is first
   solved to run from the screen's edge to beside the pedestal, every
   letter the full height of its wall, from the floor line up to the
   ceiling line that starts at the top corner of the screen. Then it is
   lifted off the floor (see LIFT) so it floats in the black above the
   marble, at the same angles and in the same shape. The centre word
   hangs from the top of the screen between the two ceiling lines.

   In CSS 3D: each word is laid out flat, then turned 90° about its near
   end so it runs straight away from the viewer, with the perspective's
   origin at the vanishing point. A plane turned a full 90° has its
   horizontal lines converge exactly on the perspective origin, so the
   baseline runs onto the floor's vanishing point by construction. The
   perspective depth P is then chosen so the word's far end lands a set
   fraction f of the way there: the scale at depth L is P / (P + L), and
   that must equal 1 − f, so P = L·(1 − f) / f.
   ================================================================== */

export type WordSet = "none" | "choose" | "options";

/* The runway, in the source frame's own pixels. */
const FRAME = { w: 1280, h: 720 };
const VP = { x: 641, y: 338 };
const EDGE_BOTTOM = { left: 91, right: 1219 };

/* How far along its floor line a word runs from the corner toward the
   vanishing point. Short of 1 so the far letters end in the dark beside
   the pedestal rather than on it; shorter on a phone, where the pedestal
   takes a larger share of the width. */
const REACH_WIDE = 0.8;
const REACH_NARROW = 0.68;

/* Where the phone's top has risen to by the lock point (frame 145), in
   the 1280x720 space the geometry is measured in — the frames now ship
   at 1920x1080, the same picture. The centre word must stay above it. */
const PHONE_TOP_AT_LOCK = 176;

/* How much of the width between the ceiling lines the centre word may
   take at most: just short of all of it, so it never touches the side
   letters. */
const CENTRE_FILL = 0.94;

/* THE CENTRE WALL IS THE FARTHEST. It stands at the end of the runway,
   behind the phone, and its letters take the size the side walls' own
   letters would have at that depth — the same shrink toward the
   vanishing point that the side words follow. The depth is where the
   pedestal meets the runway on frame 45, the frame the choice is read
   over: y 364 of the 1280x720 frame. So the centre word reads as the far
   surface of the room rather than as a banner hung in front of it. */
const BACK_WALL_Y = 364;

/* But never so far that it cannot be read: the centre word's capitals
   stand at least this tall, in px. */
const CENTRE_MIN_CAP = 30;

/* Federo's proportions, in ems, measured on the loaded face: a capital
   (and an ascender — d, b, k reach the same line) stands 0.734 tall, and
   in a line-height-1 box the baseline sits 0.83 of the way down. Fixed
   here rather than measured at run time, because a measurement taken
   before the face has loaded reads the fallback's metrics instead. */
const FACE_METRICS = { cap: 0.734, base: 0.83 };

/* THE LIFT. How far the side words stand off the floor. Each side word
   is scaled down about its own top outer corner: a uniform scale keeps
   every line at the angle it had and every letter the shape it had, and
   its top line — which runs through that corner — stays exactly where it
   was. What moves is the bottom: it rises off the marble, parallel to
   the floor edge, by the same gap all the way along, and the word hangs
   in the black above the floor instead of standing on it. */
const LIFT = 0.8;

type Wall = "left" | "back" | "right";

const WALLS: { wall: Wall; choose: string; mode: Mode; label: string }[] = [
    { wall: "left", choose: "Choose", mode: "feedback", label: "Feedback" },
    { wall: "back", choose: "A", mode: "connect", label: "Connect" },
    { wall: "right", choose: "Mode", mode: "hire", label: "Hire me!" },
];

function Letters({ text }: { text: string }) {
    return (
        <>
            {[...text].map((c, i) => {
                const glyph = c === " " ? " " : c;
                return (
                    <span
                        key={i}
                        className={styles.ch}
                        aria-hidden="true"
                        style={{ "--i": i } as React.CSSProperties}
                    >
                        {/* Its thickness is a stack of text shadows on the
                            face — see .face in the stylesheet. */}
                        <span className={styles.face}>{glyph}</span>
                    </span>
                );
            })}
        </>
    );
}

export default function ChoiceWalls({
    set,
    chosen,
    onChoose,
}: {
    set: WordSet;
    chosen: Mode | null;
    onChoose: (mode: Mode) => void;
}) {
    const rootRef = useRef<HTMLDivElement>(null);

    /* ---- the geometry ------------------------------------------------
       Written straight onto the elements as custom properties: it changes
       only with the window, and nothing in the render depends on it. */
    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const { cap, base } = FACE_METRICS;

        const solve = () => {
            const W = root.clientWidth;
            const H = root.clientHeight;
            const narrow = W < 768;
            const reach = narrow ? REACH_NARROW : REACH_WIDE;

            /* The frame is drawn cover-fit; map its points the same way. */
            const s = Math.max(W / FRAME.w, H / FRAME.h);
            const ox = (W - FRAME.w * s) / 2;
            const oy = (H - FRAME.h * s) / 2;
            const vp = { x: ox + VP.x * s, y: oy + VP.y * s };

            /* The near end of each word: where its floor line comes on
               screen, kept a little inside the edge of the window. */
            const margin = 12;
            const nearOn = (bottomX: number, side: "left" | "right") => {
                const b = { x: ox + bottomX * s, y: oy + FRAME.h * s };
                const ty = (b.y - (H - margin)) / (b.y - vp.y);
                const edgeX = side === "left" ? margin : W - margin;
                const tx = (edgeX - b.x) / (vp.x - b.x);
                const t = Math.max(0, ty, tx);
                return { x: b.x + t * (vp.x - b.x), y: b.y + t * (vp.y - b.y) };
            };
            const near = { left: nearOn(EDGE_BOTTOM.left, "left"), right: nearOn(EDGE_BOTTOM.right, "right") };

            /* THE SIDE WALLS, FLOOR TO TOP. At its near end each wall
               stands from the floor edge up to the top of the screen, and
               every letter fills that height: its capitals' ink spans it
               exactly. The ceiling line — the letters' tops — then runs
               from the top corner to the vanishing point, as the floor
               line does from the bottom, so each letter fills the wall at
               whatever depth it stands. The run along the floor is still
               fixed by the reach, so the words stay edge to edge. */
            const topY = margin;
            const sideF = (floorY: number) => Math.max(24, (floorY - topY) / cap);
            const fl = sideF(near.left.y);
            const fr = sideF(near.right.y);

            /* THE CENTRE WALL is the black above the phone, between the
               two ceiling lines. Its word is sized for its depth (see
               BACK_WALL_Y): the side walls' letter height at their near
               end, after the lift, shrunk by how much nearer the vanishing
               point the back wall stands. It is also held inside the
               ceiling lines and above where the phone's top comes to by
               the lock point, frame 145, and centred in the black between
               the top of the screen and that point. */
            const nearY = (near.left.y + near.right.y) / 2;
            const backY = oy + BACK_WALL_Y * s;
            const depthScale = Math.max(0, (backY - vp.y) / (nearY - vp.y));
            const backCap = depthScale * LIFT * (nearY - topY);
            const span = near.right.x - near.left.x;
            const drop = vp.y - topY;
            const xL = (y: number) => near.left.x + (vp.x - near.left.x) * ((y - topY) / drop);
            const xR = (y: number) => near.right.x + (vp.x - near.right.x) * ((y - topY) / drop);
            const phoneTop = oy + PHONE_TOP_AT_LOCK * s - margin;

            const st = root.style;
            st.setProperty("--vp-x", `${vp.x}px`);
            st.setProperty("--vp-y", `${vp.y}px`);

            /* The lift's pivot: each side word's top outer corner. */
            root.querySelectorAll<HTMLElement>(`.${styles.wall}`).forEach((el) => {
                const wall = el.dataset.wall as Wall;
                if (wall === "back") return;
                const corner = wall === "left" ? near.left : near.right;
                el.style.setProperty("--lift", `${LIFT}`);
                el.style.setProperty("--ox", `${corner.x}px`);
                el.style.setProperty("--oy", `${topY}px`);
            });

            /* One size for both centre words — "A" and "Connect" stand on
               the same wall at the same depth — so whichever is held in
               more by the width between the ceiling lines sets it for both. */
            /* The word is centred on inkMid, so its bottom corners sit at
               inkMid + cap·f/2, where the gap between the ceiling lines is
               span·(vp.y − y)/drop. Solving width = CENTRE_FILL × that gap
               for f gives the widest it may be. */
            const inkMidY = (topY + phoneTop) / 2;
            const fill = CENTRE_FILL * span;
            let backF = Math.min(Math.max(backCap, CENTRE_MIN_CAP), phoneTop - topY) / cap;
            root.querySelectorAll<HTMLElement>(`[data-stage][data-wall="back"]`).forEach((stage) => {
                const plane = stage.querySelector<HTMLElement>(`.${styles.plane}`);
                if (!plane) return;
                /* Width per em of this word, read at a trial size. */
                stage.style.setProperty("--f", "100px");
                const perEm = plane.offsetWidth / 100 || 1;
                const fWidth = (fill * (vp.y - inkMidY)) / drop / (perEm + (fill * cap) / (2 * drop));
                backF = Math.min(backF, fWidth);
            });
            backF = Math.max(12, backF);

            root.querySelectorAll<HTMLElement>("[data-stage]").forEach((stage) => {
                const wall = stage.dataset.wall as Wall;
                const plane = stage.querySelector<HTMLElement>(`.${styles.plane}`);
                if (!plane) return;
                const ss = stage.style;

                if (wall === "back") {
                    const f = backF;
                    const inkMid = inkMidY;
                    const inkTop = inkMid - (cap * f) / 2;
                    ss.setProperty("--f", `${f}px`);
                    ss.setProperty("--x", `${(xL(inkTop + cap * f) + xR(inkTop + cap * f)) / 2}px`);
                    ss.setProperty("--y", `${inkTop - (base - cap) * f}px`);
                    ss.setProperty("--p", `${Math.max(700, W)}px`);
                    return;
                }

                const f = wall === "left" ? fl : fr;
                const floor = wall === "left" ? near.left : near.right;
                ss.setProperty("--f", `${f}px`);
                /* One step of the cut, from the size of the screen. It runs
                   along the word, which the turn foreshortens to about a
                   third, so it is set about three times the depth it shows. */
                ss.setProperty("--cut", `${0.004 * Math.min(W, 1.78 * H)}px`);
                ss.setProperty("--x", `${wall === "left" ? floor.x : W - floor.x}px`);
                /* The box's top, placed so the baseline lands on the floor. */
                ss.setProperty("--y", `${floor.y - base * f}px`);
                /* Each word's perspective depth, from its own length. */
                const length = plane.offsetWidth;
                ss.setProperty("--p", `${Math.max(1, (length * (1 - reach)) / reach)}px`);
            });
        };

        solve();
        const ro = new ResizeObserver(solve);
        ro.observe(root);
        /* The face arrives after first paint and changes every word's
           length, so solve again once it has. */
        document.fonts?.ready.then(solve).catch(() => {});
        document.fonts?.addEventListener("loadingdone", solve);
        return () => {
            ro.disconnect();
            document.fonts?.removeEventListener("loadingdone", solve);
        };
    }, []);

    return (
        <div ref={rootRef} className={styles.walls}>
            {WALLS.map(({ wall, choose, mode, label }) => {
                /* Three states, not two. "out" plays the pop-out, which
                   starts from a visible letter — so a word that was never
                   shown must be "hidden" instead, or every letter would
                   flash for a frame on first render. Only a real swap
                   (Choose -> options) or a lost choice pops out; anything
                   else, a rewind included, simply clears. */
                const chooseState =
                    set === "choose" ? "in" : set === "options" ? "out" : "hidden";
                const optionState =
                    set !== "options"
                        ? "hidden"
                        : chosen && chosen !== mode
                            ? "out"
                            : "in";
                const live = optionState === "in";
                return (
                    <div key={wall} className={styles.wall} data-wall={wall}>
                        <div className={styles.stage} data-stage data-wall={wall}>
                            <div className={styles.plane}>
                                <span
                                    className={styles.word}
                                    data-kind="choose"
                                    data-state={chooseState}
                                    aria-hidden="true"
                                >
                                    <Letters text={choose} />
                                </span>
                            </div>
                        </div>
                        <div className={styles.stage} data-stage data-wall={wall}>
                            <div className={styles.plane}>
                                <button
                                    type="button"
                                    className={styles.word}
                                    data-kind="option"
                                    data-state={optionState}
                                    data-chosen={chosen === mode || undefined}
                                    aria-label={label}
                                    aria-pressed={chosen === mode}
                                    /* Out of the tab order and the accessibility
                                       tree whenever it is not showing, so
                                       nothing invisible can be reached. */
                                    tabIndex={live ? 0 : -1}
                                    aria-hidden={live ? undefined : true}
                                    onClick={() => live && onChoose(mode)}
                                >
                                    <Letters text={label} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
