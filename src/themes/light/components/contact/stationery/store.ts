"use client";

import { useSyncExternalStore } from "react";
import type { PaperId } from "@light/lib/site";

/* ==================================================================
   STATIONERY STORE — which paper is on the desk.

   The contact spread's two pages are separate slots of the book (Book.tsx
   places each over its own page of the photograph), so the chooser on the
   right page and the desk on the left cannot share React state through a
   parent. They share this instead: the chosen paper, and where each paper's
   place on the right page is, so a paper can fly between the two.
   ================================================================== */

/* The letter is on the desk to begin with: "Write to me" reads as a letter. */
const FIRST: PaperId = "connect";

let active: PaperId = FIRST;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

export function useActivePaper(): PaperId {
    return useSyncExternalStore(
        subscribe,
        () => active,
        () => FIRST,
    );
}

export function choosePaper(id: PaperId) {
    if (id === active) return;
    active = id;
    listeners.forEach((cb) => cb());
}

/* The paper flying back to its place, if one is. Its place stays empty
   until it lands, so it is never in two places at once. */
let homecoming: PaperId | null = null;

export function useHomecoming(): PaperId | null {
    return useSyncExternalStore(
        subscribe,
        () => homecoming,
        () => null,
    );
}

export function setHomecoming(id: PaperId | null) {
    if (id === homecoming) return;
    homecoming = id;
    listeners.forEach((cb) => cb());
}

/* Each paper's place on the right page, registered by the chooser. The
   desk measures them when it flies a paper in or sends one home. */
const places = new Map<PaperId, HTMLElement>();

/* A null (React detaching a ref) is ignored rather than deleting the
   entry. On a change of paper React detaches the chooser's refs and
   reattaches them in the same commit, and the desk, earlier in the tree,
   measures in between: deleting on null left it nothing to fly from. A
   place that has really gone is caught by isConnected instead. */
export function registerPlace(id: PaperId, el: HTMLElement | null) {
    if (el) places.set(id, el);
}

export function placeRect(id: PaperId): DOMRect | null {
    const el = places.get(id);
    return el?.isConnected ? el.getBoundingClientRect() : null;
}
