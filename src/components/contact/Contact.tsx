"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    motion,
    useMotionValue,
    useMotionValueEvent,
    useScroll,
    useSpring,
    useTransform,
} from "framer-motion";
import { useLenis } from "lenis/react";
import SequenceCanvas from "../sequence/SequenceCanvas";
import { useFrameSequence } from "../sequence/useFrameSequence";
import { useInView } from "@/lib/useinview";
import { useReducedMotion } from "@/lib/useReducedMotion";
import ContactForm, { type Mode } from "./ContactForm";
import ChoiceWalls, { type WordSet } from "./ChoiceWalls";
import { useContactForm, type ContactFormState } from "./useContactForm";
import scene from "../scene/scene.module.css";
import styles from "./Contact.module.css";

/* ==================================================================
   CONTACT — THE HOTLINE

   A choice, made in a room. Journey has just wiped the screen to black,
   and the lights come up on a marble runway leading to a red phone in a
   void. On the walls of that void: CHOOSE / A / MODE, then FEEDBACK /
   CONNECT / HIRE ME!.

     - Choose one, and the scroll carries the camera the rest of the way
       to the phone; a hand lifts the receiver; the room blurs and only
       the form you chose is left, large, in front of it.
     - Choose nothing, and the page ends at the halfway point of the
       walk. Push on and the camera rewinds to the start of the choice
       and the words pop in again — until one is picked.

   290 scrubbed frames on one pinned surface, exactly like Journey's
   beats. Everything below is a fraction of the 750svh it is pinned for.
   ================================================================== */

const COUNT = 290;

/* Frames 1..290 over the first 600svh: about 2svh a frame, the bridge's
   pace. The last 150svh holds the form. */
const FRAMES_END = 0.8;
const RUNWAY_SVH = 750;

const pFor = (frame: number) => (FRAMES_END * (frame - 1)) / (COUNT - 1);
const frameAt = (p: number) =>
    1 + Math.min(COUNT - 1, Math.floor(Math.min(1, Math.max(0, p) / FRAMES_END) * (COUNT - 1)));

/* The beats, in frames of the 290-frame set. It is the first draft's 300
   with ten dropped through the second half, so the early beats keep
   their numbers and the later ones sit a few frames earlier on the same
   picture (old 130 is 127, old 160 is 156).

   LOCK_AT is not free to choose: the page physically ends at 300svh into
   the runway (Contact.module.css, .track[data-locked]), and 300 of the
   600 frame svh is frame 145. RETURN_TO likewise matches the dock's
   anchor at 98svh. */
const CHOOSE_AT = 18; /*   Choose / A / Mode pop in                   */
const OPTIONS_AT = 45; /*  the options replace them                   */
const LOCK_AT = 145; /*    the end of the page, until a choice        */
const ARMED_FROM = 143; /* the camera must have actually got here     */
const REWIND_TO = 20; /*   just past CHOOSE_AT, so the words pop on landing */
const RETURN_TO = 48; /*   "Change mode" and the dock land here        */
const WORDS_GONE = 156; /* after a choice the words leave the walls    */
const HINT_AT = 127; /*    "Choose a mode to go on" starts to show     */

/* The first 30svh: frame 1 fades up out of Journey's black. */
const LIGHTS_UP = 0.04;

const SPRING = { stiffness: 70, damping: 28 };

/* ---- what counts as a push against the lock ----------------------
   A NEW gesture, of real size, that begins while the lock is armed.
   Trackpad momentum is a stream of wheel events a few ms apart, so the
   tail of the very scroll that arrived here would otherwise count as a
   push and rewind the moment the visitor reached the end: they would
   never see it stop them. A 200ms gap separates two gestures. */
const QUIET_MS = 200;
const WHEEL_MIN = 30;
const TOUCH_MIN = 40;

/* In and out, not ease-out: ease-out spends most of the 130 frames in
   the first 100ms, and the camera would jump rather than visibly back
   up the runway. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function hotlinePath(i: number, small: boolean) {
    return `/scene/hotline/${small ? "sm/" : ""}frame-${String(i + 1).padStart(3, "0")}.webp`;
}

export default function Contact() {
    /* The form's state lives above both branches and above any one mode,
       so a change of mind keeps what was typed. */
    const form = useContactForm();
    return useReducedMotion() ? <HeldContact form={form} /> : <ScrollContact form={form} />;
}

/* ------------------------------------------------------------------ */

function ScrollContact({ form }: { form: ContactFormState }) {
    const trackRef = useRef<HTMLElement>(null);
    const runwayRef = useRef<HTMLDivElement>(null);
    const lenis = useLenis();

    const { ref: armRef, inView: armed } = useInView<HTMLSpanElement>({
        threshold: 0,
        rootMargin: "300% 0px",
        once: true,
    });
    const frames = useFrameSequence({ count: COUNT, path: hotlinePath, enabled: armed });

    const { scrollYProgress: raw } = useScroll({
        target: runwayRef,
        offset: ["start end", "end end"],
    });
    const smooth = useSpring(raw, SPRING);

    /* What the camera shows. The spring, like every scrub on the site —
       except during a rewind or a return, when it follows the raw scroll
       so the glide's own 0.8s is what the eye sees, not a spring
       stretching it out to two seconds. */
    const display = useMotionValue(0);
    const black = useTransform(display, [0, LIGHTS_UP], [1, 0]);

    const [mode, setMode] = useState<Mode | null>(null);
    const [busy, setBusy] = useState(false);
    const [wordSet, setWordSet] = useState<WordSet>("none");
    const [formOpen, setFormOpen] = useState(false);
    const [hint, setHint] = useState<"none" | "choose" | "scroll">("none");

    const modeRef = useRef<Mode | null>(null);
    const busyRef = useRef(false);
    const tokenRef = useRef(0);

    const sync = useCallback((p: number) => {
        const f = frameAt(p);
        const m = modeRef.current;
        const b = busyRef.current;
        const nextSet: WordSet =
            b || f < CHOOSE_AT
                ? "none"
                : f < OPTIONS_AT
                    ? "choose"
                    : m && f >= WORDS_GONE
                        ? "none"
                        : "options";
        setWordSet((prev) => (prev === nextSet ? prev : nextSet));
        const open = !!m && !b && p >= FRAMES_END - 0.002;
        setFormOpen((prev) => (prev === open ? prev : open));
        const nextHint =
            b || open ? "none" : m ? (f < WORDS_GONE ? "scroll" : "none") : f >= HINT_AT ? "choose" : "none";
        setHint((prev) => (prev === nextHint ? prev : nextHint));
    }, []);

    const push = useCallback(() => {
        const p = busyRef.current ? raw.get() : smooth.get();
        display.set(p);
        sync(p);
    }, [raw, smooth, display, sync]);
    useMotionValueEvent(raw, "change", push);
    useMotionValueEvent(smooth, "change", push);

    const svh = () => (runwayRef.current?.offsetHeight ?? RUNWAY_SVH * 9) / RUNWAY_SVH;
    const yFor = useCallback((p: number) => {
        const track = trackRef.current;
        if (!track) return 0;
        return track.getBoundingClientRect().top + window.scrollY + p * RUNWAY_SVH * svh();
    }, []);

    /* ---- THE LOCK IS THE END OF THE PAGE -----------------------------
       Until a choice is made, the section is clipped at frame 145 and the
       footer is not rendered, so the document physically ends there.
       Lenis and the browser both stop at the end of a document, which
       holds against every kind of input at once — wheel, keyboard, the
       scrollbar, native touch, Tab or find-in-page reaching for something
       further down — with nothing fighting the visitor for the position.
       The earlier idea, clamping the scroll back on every event, lost
       that fight to keyboard and scrollbar and could be tabbed straight
       past.

       Clipping with overflow:clip rather than :hidden, because :clip is
       not a scroll container and so does not break the pinned sticky
       inside. The runway keeps its full height, so every progress
       fraction above keeps its meaning whether the page is locked or
       not. */
    useLayoutEffect(() => {
        const html = document.documentElement;
        if (mode) delete html.dataset.contactGate;
        else html.dataset.contactGate = "locked";
        /* The document just changed height; tell Lenis now rather than
           after its debounced resize observer, or its limit is stale. */
        lenis?.resize();
        return () => {
            delete html.dataset.contactGate;
        };
    }, [mode, lenis]);

    /* ---- glides the camera takes on its own --------------------------
       The rewind, and the way back from a form. `lock` makes Lenis ignore
       all input until it lands, so neither can be fought or doubled; a
       token and a watchdog cover the case where something else takes
       the scroll first and onComplete never fires. */
    const glide = useCallback(
        (frame: number, duration: number, after?: () => void) => {
            const token = ++tokenRef.current;
            busyRef.current = true;
            setBusy(true);
            push();
            let wd = 0;
            const finish = () => {
                if (tokenRef.current !== token) return;
                tokenRef.current += 1;
                window.clearTimeout(wd);
                busyRef.current = false;
                setBusy(false);
                smooth.jump(raw.get());
                after?.();
                push();
            };
            wd = window.setTimeout(finish, duration * 1000 + 500);
            const target = yFor(pFor(frame));
            if (lenis) {
                lenis.scrollTo(target, { duration, easing: easeInOut, lock: true, force: true, onComplete: finish });
            } else {
                window.scrollTo({ top: target, behavior: "smooth" });
            }
        },
        [lenis, yFor, push, smooth, raw],
    );

    /* ---- reading a push against the lock ------------------------------
       At the end of the page there is nothing for a push to do, so these
       only ever have to decide one thing: was that a deliberate push, and
       should the camera rewind. */
    useEffect(() => {
        let lastDown = 0;
        let gesture = false;
        let acc = 0;
        let touch: { y0: number; dy: number } | null = null;

        const atLock = () => {
            if (modeRef.current || busyRef.current) return false;
            const limit = document.documentElement.scrollHeight - window.innerHeight;
            return window.scrollY >= limit - 2 && (!lenis || lenis.isScrolling !== "smooth");
        };
        const isArmed = (now: number) =>
            atLock() && now - lastDown >= QUIET_MS && frameAt(smooth.get()) >= ARMED_FROM;
        const rewind = () => glide(REWIND_TO, 0.8);

        /* Wheel and trackpad. Lenis emits every real gesture here, before
           doing anything with it — and never its own easing, which is the
           difference between a push and a drift into the lock. */
        const offWheel = lenis?.on("virtual-scroll", ({ deltaX, deltaY, event }) => {
            if (event.type !== "wheel" || (event as WheelEvent).ctrlKey) return;
            if (busyRef.current || Math.abs(deltaY) <= Math.abs(deltaX)) return;
            const now = performance.now();
            if (deltaY < 0) {
                gesture = false;
                acc = 0;
                return;
            }
            if (!gesture || now - lastDown >= QUIET_MS) {
                gesture = isArmed(now);
                acc = 0;
            }
            lastDown = now;
            if (gesture && (acc += deltaY) >= WHEEL_MIN) {
                gesture = false;
                rewind();
            }
        });

        /* Touch is native (syncTouch is off). The swipe must START at the
           lock, and it acts on release, so the rewind never fights a live
           pan or an iOS rubber band. */
        const onTouchStart = (e: TouchEvent) => {
            touch =
                e.touches.length === 1 && isArmed(performance.now())
                    ? { y0: e.touches[0].clientY, dy: 0 }
                    : null;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (touch) touch.dy = touch.y0 - e.touches[0].clientY;
        };
        const onTouchEnd = () => {
            if (touch && touch.dy >= TOUCH_MIN && atLock()) rewind();
            touch = null;
            lastDown = performance.now();
        };

        /* Keyboard — Lenis has no key handling of its own. Holding a key
           down into the lock never counts; a fresh press at it does. */
        const onKey = (e: KeyboardEvent) => {
            if (!["PageDown", "ArrowDown", "End", " "].includes(e.key)) return;
            if (e.altKey || e.ctrlKey || e.metaKey || (e.key === " " && e.shiftKey)) return;
            if (busyRef.current) {
                e.preventDefault();
                return;
            }
            const el = e.target as HTMLElement | null;
            if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
            if (e.key === " " && el && /^(BUTTON|A)$/.test(el.tagName)) return;
            const now = performance.now();
            if (!e.repeat && isArmed(now)) {
                e.preventDefault();
                rewind();
            } else {
                lastDown = now;
            }
        };

        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: true });
        window.addEventListener("touchend", onTouchEnd, { passive: true });
        window.addEventListener("keydown", onKey);
        return () => {
            offWheel?.();
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
            window.removeEventListener("keydown", onKey);
        };
    }, [lenis, glide, smooth]);

    /* When the form opens, keyboard focus goes into it: the word that was
       chosen has left the wall, and focus left on it would strand a
       keyboard user outside the form. preventScroll, or focusing would
       nudge the pinned page. */
    const cardRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (formOpen) cardRef.current?.focus({ preventScroll: true });
    }, [formOpen]);

    const choose = useCallback(
        (m: Mode) => {
            if (busyRef.current) return;
            modeRef.current = m;
            setMode(m);
            push();
        },
        [push],
    );

    /* Back to the choice. The mode is KEPT until the camera has landed:
       dropping it at once would re-clip the page under the visitor while
       they are still far below the lock, and the document would jump. */
    const changeMode = useCallback(() => {
        glide(RETURN_TO, 1.2, () => {
            if (window.scrollY < yFor(pFor(LOCK_AT)) - 2) {
                modeRef.current = null;
                setMode(null);
            }
        });
    }, [glide, yFor]);

    return (
        <section
            ref={trackRef}
            className={styles.track}
            data-locked={mode ? undefined : true}
            data-mode={mode ?? undefined}
            data-busy={busy || undefined}
        >
            <h2 className={styles.sr}>Contact — choose a mode: Feedback, Connect or Hire me</h2>

            <div className={`${styles.sticky} ${scene.stage}`}>
                <div className={styles.room} data-blur={formOpen || undefined}>
                    {/* First paint while the frames load — the clean 1080p
                        frame 1. The canvas is transparent until it has a
                        frame to draw, so this shows through. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={scene.plate} src="/scene/hotline/still.webp" alt="" aria-hidden="true" />
                    <SequenceCanvas
                        className={scene.plate}
                        imagesRef={frames.imagesRef}
                        progress={display}
                        count={COUNT}
                        seqEnd={FRAMES_END}
                        fit="cover"
                        transparent
                        revision={frames.revision}
                    />
                </div>

                {/* Journey's wipe ends on black; the room lights up out of it. */}
                <motion.div className={styles.black} style={{ opacity: black }} aria-hidden="true" />

                <ChoiceWalls set={wordSet} chosen={mode} onChoose={choose} />

                <p className={styles.hint} data-show={hint !== "none" || undefined} aria-live="polite">
                    {hint === "choose" ? "Choose a mode to go on" : hint === "scroll" ? "Scroll to answer" : ""}
                </p>

                <div className={styles.formLayer} data-open={formOpen || undefined}>
                    {mode && (
                        <div ref={cardRef} className={styles.cardBox} data-lenis-prevent tabIndex={-1}>
                            <ContactForm
                                mode={mode}
                                form={form}
                                onChangeMode={changeMode}
                                className={styles.soloCard}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* The dock's Contact link lands on the options on the walls. */}
            <span id="contact" className={styles.contactAnchor} aria-hidden="true" />
            <span ref={armRef} className={styles.arm} aria-hidden="true" />
            <div ref={runwayRef} className={styles.runway} aria-hidden="true" />
        </section>
    );
}

/* ------------------------------------------------------------------
   Reduced motion: no frames, no lock, no rewind. The still room, the
   three options on its walls, and the form in front of it once chosen.
   ------------------------------------------------------------------ */
function HeldContact({ form }: { form: ContactFormState }) {
    const [chosen, setChosen] = useState<Mode | null>(null);
    return (
        <section id="contact" className={`${styles.held} ${scene.stage}`}>
            <h2 className={styles.sr}>Contact — choose a mode: Feedback, Connect or Hire me</h2>
            <div className={styles.room} data-blur={chosen ? true : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={scene.plate} src="/scene/hotline/still.webp" alt="" aria-hidden="true" />
            </div>
            <ChoiceWalls set={chosen ? "none" : "options"} chosen={null} onChoose={setChosen} />
            <div className={styles.formLayer} data-open={chosen ? true : undefined}>
                {chosen && (
                    <div className={styles.cardBox} data-lenis-prevent>
                        <ContactForm
                            mode={chosen}
                            form={form}
                            onChangeMode={() => setChosen(null)}
                            className={styles.soloCard}
                        />
                    </div>
                )}
            </div>
        </section>
    );
}
