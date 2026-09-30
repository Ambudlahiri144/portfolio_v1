"use client";

import { stationery } from "@light/lib/site";
import InkField from "./InkField";
import type { PaperProps } from "./paper";
import styles from "./Stationery.module.css";

/* ==================================================================
   POSTCARD — for feedback.

   A postcard's two halves: the message on the left, the address side on
   the right with the stamp in its corner. Here the "address" is the
   sender's, so there is somewhere to reply to. Its picture side is only
   seen as it turns over on the way out.
   ================================================================== */

const P = stationery.postcard;
const F = stationery.fields;

export default function Postcard({ uid, values, setValue, errors, attempt, formRef, onSubmit, stampBox }: PaperProps) {
    return (
        <div className={styles.postcard}>
            <form
                ref={formRef}
                className={`${styles.cardFace} ${styles.postcardFront}`}
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit();
                }}
            >
                <span className={styles.postcardHeading} aria-hidden="true">
                    {P.heading}
                </span>
                <div className={styles.postcardMessage}>
                    <InkField
                        id={`${uid}-pc-message`}
                        name="message"
                        label={P.message}
                        value={values.message}
                        onChange={(v) => setValue("message", v)}
                        lines={5}
                        required
                        error={errors.message}
                        attempt={attempt}
                    />
                    <p className={styles.prompt}>{P.prompt}</p>
                </div>
                <div className={styles.postcardAddress}>
                    <div className={styles.stampCorner}>{stampBox}</div>
                    <InkField
                        id={`${uid}-pc-name`}
                        name="name"
                        label={P.from}
                        aria-label={F.name}
                        value={values.name}
                        onChange={(v) => setValue("name", v)}
                        autoComplete="name"
                        required
                        error={errors.name}
                        attempt={attempt}
                    />
                    <InkField
                        id={`${uid}-pc-email`}
                        name="email"
                        type="email"
                        label={P.replyTo}
                        aria-label={F.email}
                        value={values.email}
                        onChange={(v) => setValue("email", v)}
                        autoComplete="email"
                        required
                        error={errors.email}
                        attempt={attempt}
                    />
                </div>
                {/* Enter in a line sends, as in any form. */}
                <button type="submit" hidden />
            </form>
            <div className={`${styles.cardFace} ${styles.postcardBack}`} aria-hidden="true">
                <span className={styles.greetings}>{P.picture}</span>
            </div>
        </div>
    );
}
