"use client";

import { stationery } from "@light/lib/site";
import InkField from "./InkField";
import type { PaperProps } from "./paper";
import styles from "./Stationery.module.css";

/* ==================================================================
   LETTER — for starting a conversation.

   A letter's own conventions do the form's work: the salutation is
   printed, the subject is the "Re:" line, the message is the body, the
   name is the signature, and the email is where to reply.
   ================================================================== */

const L = stationery.letter;
const F = stationery.fields;

export default function Letter({ uid, values, setValue, errors, attempt, formRef, onSubmit, stampBox }: PaperProps) {
    return (
        <form
            ref={formRef}
            className={styles.letter}
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
            }}
        >
            <div className={styles.stampCorner}>{stampBox}</div>
            <p className={styles.salutation}>{L.salutation}</p>
            <InkField
                id={`${uid}-lt-topic`}
                name="topic"
                label={L.re}
                inline
                value={values.topic}
                onChange={(v) => setValue("topic", v)}
                className={styles.re}
            />
            <InkField
                id={`${uid}-lt-message`}
                name="message"
                label={L.message}
                value={values.message}
                onChange={(v) => setValue("message", v)}
                lines={6}
                required
                error={errors.message}
                attempt={attempt}
                className={styles.letterBody}
            />
            <p className={styles.signOff}>{L.signOff}</p>
            <div className={styles.signRow}>
                <InkField
                    id={`${uid}-lt-name`}
                    name="name"
                    label={L.signature}
                    aria-label={F.name}
                    value={values.name}
                    onChange={(v) => setValue("name", v)}
                    autoComplete="name"
                    required
                    error={errors.name}
                    attempt={attempt}
                    className={styles.signature}
                />
                <InkField
                    id={`${uid}-lt-email`}
                    name="email"
                    type="email"
                    label={L.replyTo}
                    aria-label={F.email}
                    value={values.email}
                    onChange={(v) => setValue("email", v)}
                    autoComplete="email"
                    required
                    error={errors.email}
                    attempt={attempt}
                />
            </div>
            <button type="submit" hidden />
        </form>
    );
}
