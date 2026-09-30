"use client";

import { useRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { usePenField } from "../../book/pen/usePenField";
import styles from "./Stationery.module.css";

/* ==================================================================
   INK FIELD — a line to write on.

   A printed label, a ruled line (or ruled lines, for a message), and the
   words in ink. A field that stops a send gets a note pencilled in the
   margin and a loop drawn round it, the way a proofreader marks a page;
   `attempt` redraws them on each try so a second miss is noticed too.

   On the book's contact page the reader writes with the book's pen:
   while the line has focus the pen follows the caret, and each letter
   is inked in as the nib passes it (book/pen/follow.ts).

   Real labels, not placeholders: a placeholder vanishes as soon as
   someone types, leaving no way to check what a half-filled line was for.
   ================================================================== */

type Shared = {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    attempt?: number;
    /* Printed before the line on the same baseline ("Re:"), not above it. */
    inline?: boolean;
    className?: string;
};

type FieldProps = Shared &
    (
        | ({ lines?: undefined } & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">)
        | ({ lines: number } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "value" | "onChange">)
    );

export default function InkField(props: FieldProps) {
    const { id, label, value, onChange, error, attempt = 0, inline, className, lines, ...rest } = props;
    const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
    usePenField(field);
    return (
        <div
            className={`${styles.field} ${inline ? styles.fieldInline : ""} ${className ?? ""}`}
            data-error={error ? true : undefined}
        >
            <label className={styles.fieldLabel} htmlFor={id}>
                {label}
            </label>
            {lines ? (
                <textarea
                    ref={field}
                    id={id}
                    className={`${styles.ink} ${styles.inkLines}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={lines}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-note` : undefined}
                    {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
                />
            ) : (
                <input
                    ref={field}
                    id={id}
                    className={styles.ink}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-note` : undefined}
                    {...(rest as InputHTMLAttributes<HTMLInputElement>)}
                />
            )}
            {error && <MarginNote key={attempt} id={`${id}-note`} text={error} />}
        </div>
    );
}

/* Red pencil: a loop round the line and a word in the margin. */
export function MarginNote({ id, text }: { id: string; text: string }) {
    return (
        <>
            <svg className={styles.loop} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                <path
                    pathLength={1}
                    d="M6 24 C5 11 32 5 58 5 C84 5 97 12 95 22 C93 33 66 37 44 36 C20 35 3 30 7 17 C9 11 18 8 27 7"
                />
            </svg>
            <span id={id} className={styles.note} role="alert">
                {text}
            </span>
        </>
    );
}
