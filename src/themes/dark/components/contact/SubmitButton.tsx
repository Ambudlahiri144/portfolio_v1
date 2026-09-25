"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ContactForm.module.css";

/* How long the pop runs. Kept in sync with @keyframes pop in the stylesheet —
   the class name is hashed by CSS Modules, so matching on animationName in an
   onAnimationEnd handler is not reliable enough to drive state off. */
const POP_MS = 320;

export default function SubmitButton({
    label,
    pending,
    disabled,
}: {
    label: string;
    pending?: boolean;
    disabled?: boolean;
}) {
    const [popping, setPopping] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    /* Clears on unmount so a pop started on the last click of a session cannot
       fire setState into a component that is already gone. */
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const pop = () => {
        if (disabled || pending) return;
        setPopping(false);
        /* Two frames, not one. Removing and re-adding the class in the same
           frame is coalesced by the browser and the animation never restarts,
           so a second click in quick succession would do nothing visible. */
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                setPopping(true);
                window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => setPopping(false), POP_MS);
            }),
        );
    };

    return (
        <button
            type="submit"
            className={styles.submit}
            /* pointerdown, not click. The pop should answer the press itself;
               waiting for click delays it behind the form's own validation and
               makes the button feel a beat slow. */
            onPointerDown={pop}
            disabled={disabled || pending}
            data-pending={pending || undefined}
            data-pop={popping || undefined}
        >
            {/* The hover sweep. A band of light that travels the width of the
                button on a loop — the same visual grammar as an indeterminate
                progress bar, which is what makes the button read as ready to
                do work rather than merely highlighted. */}
            <span className={styles.sweep} aria-hidden="true" />
            <span className={styles.submitLabel}>
                {pending ? "Sending…" : label}
            </span>
        </button>
    );
}
