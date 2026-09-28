"use client";

import { createContext, useContext } from "react";
import type { MotionValue } from "framer-motion";

/* ==================================================================
   BOOK NAV — how pieces inside the stage move the reader.

   The book is scroll: to turn a page, something has to move the scroll
   position. This hands components the two tools for that, so the
   dog-ear, the pop-up and anything later all move through the book the
   same way:

     progress           the smoothed 0..1 the canvas draws from. `.jump()`
                        on it skips the smoothing, for a drag that must
                        track the hand exactly.
     scrollToProgress   put the page at a point in the book, animated or
                        immediate.
   ================================================================== */

export type BookNav = {
    progress: MotionValue<number>;
    scrollToProgress: (p: number, opts?: { immediate?: boolean; duration?: number }) => void;
};

export const BookNavContext = createContext<BookNav | null>(null);

export function useBookNav() {
    const nav = useContext(BookNavContext);
    if (!nav) throw new Error("useBookNav must be used inside the book stage");
    return nav;
}
