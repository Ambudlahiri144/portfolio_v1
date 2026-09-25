"use client";

import { useId } from "react";
import { contactForm } from "@/lib/site";
import HirePanel, { Field } from "./HirePanel";
import SubmitButton from "./SubmitButton";
import type { ContactFormState } from "./useContactForm";
import styles from "./ContactForm.module.css";

/* ==================================================================
   CONTACT FORM — ONE MODE AT A TIME

   This was a single card with three tabs. Contact is now a choice game:
   the visitor picks Feedback, Connect or Hire me on the walls of the
   scene, and only the form they chose appears. So this renders exactly
   one mode, with no tablist — the choice has already been made, out in
   the room, and a row of tabs here would be a second way of making it.

   The contents of each mode are unchanged: the same fields, the same
   payloads, the same /api/contact and /api/verify flows. The state lives
   one level up (useContactForm), so what was typed survives changing
   mode.
   ================================================================== */

export type Mode = (typeof contactForm.tabs)[number]["id"];

export default function ContactForm({
    mode,
    form,
    onChangeMode,
    className,
}: {
    mode: Mode;
    form: ContactFormState;
    /* Back to the choice. Absent where there is nothing to go back to. */
    onChangeMode?: () => void;
    /* Extra sizing from the caller: the section shows this large. */
    className?: string;
}) {
    const uid = useId();
    const { values, setValue, send, pending, result } = form;
    const tab = contactForm.tabs.find((t) => t.id === mode) ?? contactForm.tabs[0];

    return (
        <div className={`${styles.card} ${className ?? ""}`} data-mode={mode}>
            <div className={styles.soloHead}>
                <span className={styles.soloEyebrow}>{contactForm.heading}</span>
                {onChangeMode && (
                    <button type="button" className={styles.changeMode} onClick={onChangeMode}>
                        <span aria-hidden="true">←</span> Change mode
                    </button>
                )}
            </div>

            <h3 className={styles.heading}>{tab.title}</h3>

            <div className={styles.panel}>
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
                                <SubmitButton label={contactForm.submit} pending={pending} />
                                <p
                                    className={styles.status}
                                    data-error={result && !result.ok ? true : undefined}
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
    );
}
