"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { contactForm } from "@/lib/site";
import HirePanel, { Field } from "./HirePanel";
import SubmitButton from "./SubmitButton";
import styles from "./ContactForm.module.css";

/* ==================================================================
   CONTACT FORM

   Three reasons someone might be at the bottom of this page, each
   with the fields that actually apply to it — rather than one generic
   box that makes everyone write the context themselves.
   ================================================================== */

const TABS = contactForm.tabs;

/* contactForm is `as const`, so TABS[0].id narrows to the literal "feedback".
   Left to infer, useState would refuse every other tab. */
type TabId = (typeof TABS)[number]["id"];

type Values = {
    name: string;
    email: string;
    topic: string;
    message: string;
    capacity: string;
};

const EMPTY: Values = { name: "", email: "", topic: "", message: "", capacity: "" };

/* How far the blob stretches, as a function of how far it has to travel.
   Capped so a jump across the whole row does not smear into a line.
   Same curve as the dock's, scaled for the shorter distances here. */
function stretchFor(distancePx: number) {
    return 1 + Math.min(Math.abs(distancePx) / 260, 0.4);
}

export default function ContactForm() {
    const uid = useId();
    const [active, setActive] = useState<TabId>(TABS[0].id);

    /* One state object across all three tabs, not one per tab.

       Name and email are the same person whichever tab they are on, so asking
       twice would be rude — and someone who starts typing under Feedback and
       realises it belongs under Connect should not lose the paragraph they
       just wrote to a mis-click. */
    const [values, setValues] = useState<Values>(EMPTY);
    const [pending, setPending] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
        null,
    );

    const setValue = useCallback((key: string, value: string) => {
        setValues((v) => ({ ...v, [key]: value }));
        /* Any edit clears the last outcome. Leaving "Message sent" sitting
           above a form someone is retyping reads as though the new one has
           already gone too. */
        setResult(null);
    }, []);

    const send = useCallback(
        async (extra: Record<string, string>) => {
            setPending(true);
            setResult(null);
            try {
                const res = await fetch("/api/contact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...values, ...extra }),
                });
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    setResult({
                        ok: false,
                        message: data.error ?? "Could not send that.",
                    });
                    return;
                }

                setResult({ ok: true, message: "Sent — thank you." });
                /* Keep name and email; clear what was actually said. Someone
                   sending a second message should not retype who they are. */
                setValues((v) => ({ ...v, topic: "", message: "", capacity: "" }));
            } catch {
                setResult({ ok: false, message: "Network error. Please try again." });
            } finally {
                setPending(false);
            }
        },
        [values],
    );

    const tab = TABS.find((t) => t.id === active) ?? TABS[0];

    /* ---- travelling blob -------------------------------------------
       Same mechanism as the dock's: an outer node that translates on an
       overshooting curve, and an inner node that squashes along the axis of
       travel. They are separate elements so the two motions can run on
       independent timing curves without fighting over one transform. */
    const tabsRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const [blob, setBlob] = useState({ x: 0, w: 0, ready: false });
    /* Bumped on every move so the squash animation can restart — a keyed
       remount is the only reliable way to replay a CSS animation. */
    const [moveKey, setMoveKey] = useState(0);
    const [stretch, setStretch] = useState(1);

    const measure = useCallback(() => {
        const el = tabRefs.current[active];
        if (!el) return;
        setBlob((prev) => {
            const next = { x: el.offsetLeft, w: el.offsetWidth, ready: true };
            /* Skip the write when nothing moved — otherwise the ResizeObserver
               below re-fires on its own output and loops. */
            if (prev.x === next.x && prev.w === next.w && prev.ready) return prev;
            return next;
        });
    }, [active]);

    useEffect(() => {
        measure();
    }, [measure]);

    /* Re-measure on resize and on font load, both of which shift the row's
       geometry after first paint — these are text labels, so a late webfont
       changes every tab's width. */
    useEffect(() => {
        const row = tabsRef.current;
        if (!row) return;
        const ro = new ResizeObserver(measure);
        ro.observe(row);
        return () => ro.disconnect();
    }, [measure]);

    const selectTab = (id: TabId) => {
        if (id === active) return;
        const from = tabRefs.current[active];
        const to = tabRefs.current[id];
        if (from && to) setStretch(stretchFor(to.offsetLeft - from.offsetLeft));
        setActive(id);
        setMoveKey((k) => k + 1);
    };

    /* ---- nested scrolling -------------------------------------------
       Lenis intercepts wheel events for the whole document, so the panel's
       own overflow never saw them — only dragging the scrollbar worked.
       `data-lenis-prevent` tells Lenis to skip any wheel whose composed path
       includes this element, which hands it back to native scrolling.

       Applied ONLY while the panel actually overflows. Left on permanently it
       would swallow the wheel over a short tab and freeze the page instead. */
    const panelRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scrollable, setScrollable] = useState(false);

    useEffect(() => {
        const panel = panelRef.current;
        const content = contentRef.current;
        if (!panel || !content) return;

        const check = () =>
            setScrollable((prev) => {
                /* 1px of slack. Sub-pixel layout rounding otherwise reports a
                   one-pixel overflow on panels that visibly have none. */
                const next = panel.scrollHeight > panel.clientHeight + 1;
                return prev === next ? prev : next;
            });

        check();
        /* Both boxes matter: the panel's height changes with the viewport, and
           the content's changes with the tab, the sub-tab, and every step of
           the verification flow. */
        const ro = new ResizeObserver(check);
        ro.observe(panel);
        ro.observe(content);
        return () => ro.disconnect();
    }, [active]);

    return (
        <div className={styles.card}>
            <h3 className={styles.heading}>{contactForm.heading}</h3>

            <div
                ref={tabsRef}
                className={styles.tabs}
                role="tablist"
                aria-label="What brings you here"
            >
                {/* The blob. Decorative only — the active tab is announced by
                    aria-selected, not by anything visual. */}
                <span
                    className={styles.blobTrack}
                    aria-hidden="true"
                    style={{
                        transform: `translate3d(${blob.x}px, -50%, 0)`,
                        width: blob.w || undefined,
                        opacity: blob.ready ? 1 : 0,
                    }}
                >
                    <span
                        key={moveKey}
                        className={`${styles.blob} ${moveKey > 0 ? styles.blobMoving : ""}`}
                        style={{ "--stretch": stretch } as React.CSSProperties}
                    />
                </span>

                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        id={`${uid}-tab-${t.id}`}
                        aria-selected={active === t.id}
                        aria-controls={`${uid}-panel-${t.id}`}
                        /* Only the selected tab is in the tab order; the arrow
                           keys move between them. That is the expected pattern
                           for a tablist — otherwise every tab is a separate
                           stop and getting past them takes three presses. */
                        tabIndex={active === t.id ? 0 : -1}
                        ref={(el) => {
                            tabRefs.current[t.id] = el;
                        }}
                        className={styles.tab}
                        data-active={active === t.id || undefined}
                        onClick={() => selectTab(t.id)}
                        onKeyDown={(e) => {
                            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                            e.preventDefault();
                            const i = TABS.findIndex((x) => x.id === active);
                            const next =
                                e.key === "ArrowRight"
                                    ? (i + 1) % TABS.length
                                    : (i - 1 + TABS.length) % TABS.length;
                            selectTab(TABS[next].id);
                            document
                                .getElementById(`${uid}-tab-${TABS[next].id}`)
                                ?.focus();
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div
                ref={panelRef}
                className={styles.panel}
                role="tabpanel"
                id={`${uid}-panel-${tab.id}`}
                aria-labelledby={`${uid}-tab-${tab.id}`}
                tabIndex={0}
                /* Present only while there is something to scroll — see the
                   effect above. */
                data-lenis-prevent={scrollable || undefined}
            >
                <div ref={contentRef}>
                <h4 className={styles.panelTitle}>{tab.title}</h4>

                {tab.id === "hire" ? (
                    <HirePanel
                        values={values}
                        setValue={setValue}
                        onSend={send}
                        pending={pending}
                        result={result}
                    />
                ) : (
                    <div className={styles.panelBody}>
                        <p className={styles.blurb}>{tab.blurb}</p>
                        <form
                            className={styles.form}
                            onSubmit={(e) => {
                                e.preventDefault();
                                send({ kind: tab.id });
                            }}
                        >
                            <div className={styles.row}>
                                <Field
                                    id={`${uid}-name`}
                                    name="name"
                                    label={contactForm.fields.name}
                                    value={values.name}
                                    onChange={(v) => setValue("name", v)}
                                    autoComplete="name"
                                    required
                                />
                                <Field
                                    id={`${uid}-email`}
                                    name="email"
                                    label={contactForm.fields.email}
                                    type="email"
                                    value={values.email}
                                    onChange={(v) => setValue("email", v)}
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            {tab.id === "connect" && (
                                <Field
                                    id={`${uid}-topic`}
                                    name="topic"
                                    label={contactForm.fields.topic}
                                    value={values.topic}
                                    onChange={(v) => setValue("topic", v)}
                                />
                            )}

                            <Field
                                id={`${uid}-message`}
                                name="message"
                                label={tab.messageLabel}
                                value={values.message}
                                onChange={(v) => setValue("message", v)}
                                textarea
                                required
                            />

                            <div className={styles.actions}>
                                <SubmitButton
                                    label={contactForm.submit}
                                    pending={pending}
                                />
                                <p
                                    className={styles.status}
                                    data-error={
                                        result && !result.ok ? true : undefined
                                    }
                                    role="status"
                                    aria-live="polite"
                                >
                                    {result?.message ?? ""}
                                </p>
                            </div>
                        </form>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
