"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { stationery, type PaperId } from "@light/lib/site";
import { useReducedMotion } from "@light/lib/useReducedMotion";
import Envelope, { type SentLetter } from "../Envelope";
import { DESK_ID } from "./Chooser";
import Engagement, { type Hire } from "./Engagement";
import Letter from "./Letter";
import Postcard from "./Postcard";
import { check, type Errors, type PaperProps } from "./paper";
import { HandStamp, Postmark, RubberStamp, StuckStamp, postmarkDate, type HandStampHandle } from "./Stamp";
import { placeRect, setHomecoming, useActivePaper } from "./store";
import { EMPTY, useContactSend, type Values } from "./useContactSend";
import styles from "./Stationery.module.css";

/* ==================================================================
   WRITING DESK — the left page of the contact spread.

   The chosen paper lies here to be written on. Choosing another flies
   this one back to its place on the right page and the new one across
   (FLIP: each paper is drawn where it ends, then animated from where it
   was). Sending is sticking the stamp on:

     writing   the paper, the stamp in hand, a Send button
     stamped   the stamp is on; the message is in the post (request)
     posted    the postmark inks over it
     leaving   the paper goes: the letter into its envelope, the
               postcard turned over and away, the card sealed and filed
     sent      a note on the empty page, and "Write another"

   Name and email are the same person whichever paper they are on, so
   one set of values serves all three, and survives a change of paper.
   ================================================================== */

type Phase = "writing" | "stamped" | "posted" | "leaving" | "sent";

/* At least this long between the stamp landing and the postmark, so a
   quick server does not rush the moment. */
const STICK_MS = 520;
const POSTMARK_MS = 900;
/* The postcard's and the card's exits (Stationery.module.css). */
const LEAVE_MS: Record<PaperId, number> = { feedback: 1500, connect: 0, hire: 1900 };

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/* The transform that puts a box drawn at `to` over `from`. */
function flipFrom(from: DOMRect, to: DOMRect) {
    return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
}

function onScreen(r: DOMRect) {
    return r.bottom > 0 && r.top < window.innerHeight;
}

type Spec = { kind: string; field?: string } | "choose" | "verify";

/* What sending this paper posts, or why it cannot be sent by stamp. */
function specFor(paper: PaperId, hire: Hire): Spec {
    if (paper === "feedback") return { kind: "feedback" };
    if (paper === "connect") return { kind: "connect" };
    if (hire.sub === "freelance") return { kind: "freelance" };
    if (hire.sub === "employee" && hire.field === "others") return { kind: "hire", field: "Others" };
    if (hire.sub === "employee" && hire.field) return "verify";
    return "choose";
}

export default function WritingDesk() {
    const uid = useId();
    const reduced = useReducedMotion();
    const active = useActivePaper();

    /* The paper on the desk, and the one flying home. Updated during render
       when the store changes, so both are drawn in the same frame. */
    const [current, setCurrent] = useState<PaperId>(active);
    const [leaving, setLeaving] = useState<PaperId | null>(null);
    if (current !== active) {
        setLeaving(current);
        setCurrent(active);
    }

    const [values, setValues] = useState<Values>(EMPTY);
    const [errors, setErrors] = useState<Errors>({});
    const [attempt, setAttempt] = useState(0);
    const [hire, setHireState] = useState<Hire>({ sub: null, field: "" });
    const [phase, setPhase] = useState<Phase>("writing");
    const [status, setStatus] = useState("");
    const [letter, setLetter] = useState<SentLetter | null>(null);
    const [date, setDate] = useState("");
    const { send } = useContactSend();

    const formRef = useRef<HTMLFormElement>(null);
    const target = useRef<HTMLSpanElement>(null);
    const hand = useRef<HandStampHandle>(null);
    const flightFrom = useRef<DOMRect | null>(null);
    const paperEl = useRef<HTMLDivElement>(null);
    const leavingEl = useRef<HTMLDivElement>(null);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    const setValue = useCallback((k: keyof Values, v: string) => {
        setValues((o) => ({ ...o, [k]: v }));
        setErrors((e) => {
            if (!e[k]) return e;
            const next = { ...e };
            delete next[k];
            return next;
        });
        setStatus("");
    }, []);

    const setHire = useCallback((h: Hire) => {
        setHireState(h);
        setErrors((e) => {
            if (!e.choice) return e;
            const next = { ...e };
            delete next.choice;
            return next;
        });
    }, []);

    const spec = specFor(current, hire);
    const stampable = spec !== "verify";

    /* ---- sending ---------------------------------------------------- */

    /* Asked by the stamp when it is dropped on the box, and by Send. True
       if the paper is going: the stamp stays stuck. */
    const requestSend = (from: DOMRect | null): boolean => {
        if (phase !== "writing" || spec === "verify") return false;
        const form = formRef.current;
        const errs: Errors = form ? check(form) : {};
        if (spec === "choose") errs.choice = stationery.errors.choice;
        if (Object.keys(errs).length > 0 || spec === "choose") {
            setErrors(errs);
            setAttempt((a) => a + 1);
            return false;
        }
        flightFrom.current = from;
        setStatus("");
        setPhase("stamped");
        const sentValues = values;
        const paper = current;
        void (async () => {
            const [res] = await Promise.all([send(sentValues, spec), wait(STICK_MS)]);
            if (!alive.current) return;
            if (!res.ok) {
                setPhase("writing");
                setStatus(res.message);
                return;
            }
            setLetter({ name: sentValues.name, message: sentValues.message });
            setDate(postmarkDate());
            setPhase("posted");
            await wait(POSTMARK_MS);
            if (!alive.current) return;
            setPhase("leaving");
            if (paper === "connect") return; /* the envelope takes it from here */
            await wait(reduced ? 0 : LEAVE_MS[paper]);
            if (alive.current) setPhase("sent");
        })();
        return true;
    };

    const again = () => {
        /* Keep who is writing; clear what was said. */
        setValues((v) => ({ ...v, topic: "", message: "", capacity: "" }));
        setErrors({});
        setLetter(null);
        setPhase("writing");
    };

    /* ---- flying between the pages ----------------------------------- */

    const first = useRef(true);
    useLayoutEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const el = paperEl.current;
        if (!el) return;
        const to = el.getBoundingClientRect();
        const from = placeRect(current);
        if (reduced || !from || !onScreen(from) || !onScreen(to)) {
            el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
            /* Unbound, the desk can be a screen away from the chooser. */
            if (!onScreen(to)) el.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
            return;
        }
        el.animate(
            [
                { transform: flipFrom(from, to) },
                /* Lifted a little as it comes down onto the page. */
                { transform: "translateY(-0.6em) scale(1.01)", offset: 0.7 },
                { transform: "none" },
            ],
            { duration: 680, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
    }, [current, reduced]);

    useLayoutEffect(() => {
        const el = leavingEl.current;
        if (!leaving || !el) return;
        setHomecoming(leaving);
        const from = el.getBoundingClientRect();
        const to = placeRect(leaving);
        const anim =
            reduced || !to || !onScreen(to)
                ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" })
                : el.animate([{ transform: "none", opacity: 1 }, { transform: flipFrom(to, from), opacity: 1 }], {
                      duration: 560,
                      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                      fill: "forwards",
                  });
        anim.onfinish = () => {
            setLeaving(null);
            setHomecoming(null);
        };
        return () => {
            anim.onfinish = null;
            anim.cancel();
            setHomecoming(null);
        };
    }, [leaving, reduced]);

    /* ---- drawing ---------------------------------------------------- */

    const stuck = phase === "stamped" || phase === "posted" || phase === "leaving";
    const stampBox = (
        <span ref={target} className={styles.stampBox} data-filled={stuck || undefined}>
            <span className={styles.stampBoxLabel}>{stationery.stamp.target}</span>
            {stuck && <StuckStamp from={flightFrom} trembling={phase === "stamped"} />}
            {(phase === "posted" || phase === "leaving") && <Postmark date={date} />}
        </span>
    );

    const paperProps: PaperProps = {
        uid,
        values,
        setValue,
        errors,
        attempt,
        formRef,
        onSubmit: () => requestSend(hand.current?.rect() ?? null),
        stampBox,
    };

    const paperFor = (id: PaperId, props: PaperProps) =>
        id === "feedback" ? (
            <Postcard {...props} />
        ) : id === "connect" ? (
            <Letter {...props} />
        ) : (
            <Engagement {...props} hire={hire} setHire={setHire} />
        );

    return (
        <div
            className={styles.desk}
            id={DESK_ID}
            role="tabpanel"
            aria-labelledby={`paper-tab-${current}`}
        >
            <div className={styles.surface}>
                {phase === "sent" ? (
                    <SentNote first={letter?.name} onAgain={again} />
                ) : phase === "leaving" && current === "connect" && letter ? (
                    <Envelope letter={letter} onAgain={again} />
                ) : (
                    <div
                        ref={paperEl}
                        className={styles.paper}
                        data-paper={current}
                        data-leaving={phase === "leaving" || undefined}
                        inert={phase !== "writing"}
                    >
                        {paperFor(current, paperProps)}
                        {phase === "leaving" && current === "hire" && (
                            <>
                                <RubberStamp text={stationery.sent.received} className={styles.receivedStamp} />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img className={styles.cardSeal} src="/book/props/wax-seal.webp" alt="" />
                            </>
                        )}
                    </div>
                )}

                {leaving && (
                    <div ref={leavingEl} className={`${styles.paper} ${styles.paperLeaving}`} data-paper={leaving} inert aria-hidden="true">
                        {paperFor(leaving, {
                            ...paperProps,
                            formRef: undefined,
                            onSubmit: () => {},
                            stampBox: <span className={styles.stampBox}><span className={styles.stampBoxLabel}>{stationery.stamp.target}</span></span>,
                            uid: `${uid}-away`,
                        })}
                    </div>
                )}
            </div>

            <div
                className={styles.post}
                data-quiet={phase !== "writing" || undefined}
                data-gone={phase === "leaving" || phase === "sent" || undefined}
            >
                {stampable ? (
                    <>
                        <p className={styles.postHint}>
                            {stationery.stamp.hint}{" "}
                            <button
                                type="button"
                                className={`${styles.pill} ink`}
                                disabled={phase !== "writing"}
                                onClick={() => requestSend(hand.current?.rect() ?? null)}
                            >
                                {phase === "stamped" ? `${stationery.stamp.sending}…` : stationery.stamp.send}
                            </button>
                        </p>
                        <HandStamp ref={hand} target={target} onDrop={requestSend} hidden={phase !== "writing"} />
                    </>
                ) : null}
                <p className={styles.status} data-error role="status" aria-live="polite">
                    {status}
                </p>
            </div>
        </div>
    );
}

function SentNote({ first, onAgain }: { first?: string; onAgain: () => void }) {
    const S = stationery.sent;
    return (
        <div className={styles.sent} role="status">
            <p className={styles.sentTitle}>{S.title}</p>
            <p className={styles.sentBody}>
                {first ? `${first.split(" ")[0]}, ` : ""}
                {first ? S.body.charAt(0).toLowerCase() + S.body.slice(1) : S.body}
            </p>
            <button type="button" className={styles.again} onClick={onAgain}>
                {S.again}
            </button>
        </div>
    );
}
