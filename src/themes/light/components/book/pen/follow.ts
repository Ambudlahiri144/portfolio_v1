/* ==================================================================
   FOLLOW — the reader writing, with the book's pen.

   A field that is being written in (a line on the contact page's
   stationery) tells the pen where its caret is; the pen goes to it and
   writes each new letter as it is typed: the nib moves along the line,
   and the letters appear under it as it passes (PenLayer masks the rest
   of the line, see `.ink[data-inking]`).

   This is only the channel between the fields and the pen. Without a
   pen on the stage (phones, reduced motion, /experience) nothing
   listens, and the fields simply behave as fields.
   ================================================================== */

/* Where the caret is, in the field's own box (px): its left edge, the top
   and height of its line, where that line's text starts, and whether it
   is at the very end of the text (only then can new letters be inked in
   behind the pen: anywhere else they are between letters already there). */
export type Caret = { x: number; top: number; h: number; left: number; atEnd: boolean };

export type FollowTarget = {
    el: HTMLElement;
    caret: () => Caret | null;
    /* Whether typed letters are revealed by the nib (text lines), or just
       followed (the code slots, which have their own press-in). */
    ink: boolean;
};

/* What just happened in the field. A jump of the caret (focus, a paste, a
   click elsewhere in the text) moves the pen there; typing writes. */
export type FollowKind = "focus" | "type" | "delete" | "paste" | "move";

export const following = {
    target: null as FollowTarget | null,
    kind: "move" as FollowKind,
    version: 0,
};

const listeners = new Set<() => void>();

export function onFollow(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

function bump(kind: FollowKind) {
    following.kind = kind;
    following.version++;
    listeners.forEach((cb) => cb());
}

export function follow(t: FollowTarget) {
    following.target = t;
    bump("focus");
}

export function nudge(el: HTMLElement, kind: FollowKind) {
    if (following.target?.el === el) bump(kind);
}

export function release(el: HTMLElement) {
    if (following.target?.el !== el) return;
    following.target = null;
    bump("move");
}
