"use client";

import { useRef, type KeyboardEvent } from "react";
import styles from "./Stationery.module.css";

/* ==================================================================
   CIRCLE CHOICE — printed options, one circled in ink.

   How a printed form is answered by hand: the words are all there, and
   you ring the one that applies. A radio group underneath (roving
   tabindex, arrow keys), so it reads and works as one.
   ================================================================== */

export default function CircleChoice<T extends string>({
    label,
    options,
    value,
    onChange,
    error,
}: {
    label: string;
    options: { id: T; label: string }[];
    value: T | null;
    onChange: (id: T) => void;
    error?: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const current = options.findIndex((o) => o.id === value);

    const onKey = (e: KeyboardEvent, i: number) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = (i + step + options.length) % options.length;
        onChange(options[next].id);
        refs.current[next]?.focus();
    };

    return (
        <div className={styles.choices} role="radiogroup" aria-label={label} data-error={error ? true : undefined}>
            {options.map((o, i) => {
                const checked = o.id === value;
                return (
                    <button
                        key={o.id}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={checked || (current < 0 && i === 0) ? 0 : -1}
                        className={styles.choice}
                        onClick={() => onChange(o.id)}
                        onKeyDown={(e) => onKey(e, i)}
                    >
                        {o.label}
                        {checked && (
                            <svg className={styles.ring} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                                <path
                                    pathLength={1}
                                    d="M9 23 C7 10 36 4 60 5 C85 6 97 13 95 22 C93 32 66 37 43 36 C19 35 4 30 8 18 C10 12 19 8 29 7"
                                />
                            </svg>
                        )}
                    </button>
                );
            })}
            {error && (
                <span className={styles.note} role="alert">
                    {error}
                </span>
            )}
        </div>
    );
}
