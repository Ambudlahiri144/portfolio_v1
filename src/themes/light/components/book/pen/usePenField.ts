"use client";

import { useEffect, useRef, type RefObject } from "react";
import { caretOf } from "./caret";
import { follow, nudge, release, type Caret, type FollowKind } from "./follow";

/* A field written in with the book's pen: while it has focus, the pen
   follows its caret and inks each letter typed (see follow.ts). `caret`
   replaces the measured caret for fields drawn differently from their
   input (the code slots), and `ink: false` follows without revealing. */
export function usePenField(
    ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
    opts: { caret?: () => Caret | null; ink?: boolean } = {},
) {
    /* The latest options, read when the pen asks, so a new closure on each
       render does not re-register the field. */
    const latest = useRef(opts);
    useEffect(() => {
        latest.current = opts;
    });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const target = {
            el,
            caret: () => (latest.current.caret ? latest.current.caret() : caretOf(el)),
            ink: latest.current.ink ?? true,
        };
        const kindOf = (e: Event): FollowKind => {
            const t = (e as InputEvent).inputType ?? "";
            if (t === "insertFromPaste" || t === "insertFromDrop" || t === "insertReplacementText") return "paste";
            if (t.startsWith("delete")) return "delete";
            return "type";
        };
        const onFocus = () => follow(target);
        const onBlur = () => release(el);
        const onInput = (e: Event) => nudge(el, kindOf(e));
        const onMove = () => nudge(el, "move");
        el.addEventListener("focus", onFocus);
        el.addEventListener("blur", onBlur);
        el.addEventListener("input", onInput);
        /* The caret moved without typing: arrows, Home/End, a click, a
           selection. */
        el.addEventListener("keyup", onMove);
        el.addEventListener("pointerup", onMove);
        el.addEventListener("select", onMove);
        el.addEventListener("scroll", onMove);
        if (document.activeElement === el) onFocus();
        return () => {
            el.removeEventListener("focus", onFocus);
            el.removeEventListener("blur", onBlur);
            el.removeEventListener("input", onInput);
            el.removeEventListener("keyup", onMove);
            el.removeEventListener("pointerup", onMove);
            el.removeEventListener("select", onMove);
            el.removeEventListener("scroll", onMove);
            release(el);
        };
    }, [ref]);
}
