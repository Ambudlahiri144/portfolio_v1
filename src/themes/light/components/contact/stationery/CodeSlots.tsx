"use client";

import { useRef, useState } from "react";
import { usePenField } from "../../book/pen/usePenField";
import styles from "./Stationery.module.css";

/* ==================================================================
   CODE SLOTS — six digits, set like type.

   One real input (so paste, autofill of one-time codes, and the numeric
   keyboard all just work), drawn as six slots. Each digit presses into
   its slot as it arrives, like a sort dropped into a composing stick.
   The book's pen waits over the next slot to be filled.
   ================================================================== */

const LENGTH = 6;

export default function CodeSlots({
    id,
    label,
    value,
    onChange,
    disabled,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    const [focused, setFocused] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const slots = useRef<(HTMLSpanElement | null)[]>([]);
    /* The input lies over the slots, so a caret in it means nothing: the
       pen goes to the slot the next digit will fill instead. */
    usePenField(input, {
        ink: false,
        caret: () => {
            const i = Math.min(input.current?.value.length ?? 0, LENGTH - 1);
            const s = slots.current[i];
            if (!s) return null;
            const x = s.offsetLeft + s.offsetWidth * 0.4;
            return { x, top: s.offsetTop + s.offsetHeight * 0.1, h: s.offsetHeight * 0.85, left: x, atEnd: false };
        },
    });
    return (
        <div className={styles.codeField}>
            <label className={styles.fieldLabel} htmlFor={id}>
                {label}
            </label>
            <div className={styles.slots} data-focused={focused || undefined}>
                <input
                    ref={input}
                    id={id}
                    className={styles.codeInput}
                    value={value}
                    onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, LENGTH))}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={LENGTH}
                    disabled={disabled}
                    required
                />
                {Array.from({ length: LENGTH }, (_, i) => (
                    <span
                        key={`${i}-${value[i] ?? ""}`}
                        ref={(el) => {
                            slots.current[i] = el;
                        }}
                        className={styles.slot}
                        data-filled={value[i] ? true : undefined}
                        data-next={focused && i === Math.min(value.length, LENGTH - 1) ? true : undefined}
                        aria-hidden="true"
                    >
                        {value[i] ?? ""}
                    </span>
                ))}
            </div>
        </div>
    );
}
