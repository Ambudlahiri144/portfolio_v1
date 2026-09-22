"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import DOC from "@/shaders/sylva-living-world/sources/sakuraDocument";
import THREE_RUNTIME from "@/shaders/sylva-living-world/sources/threeRuntime";

/* ==================================================================
   THE SAKURA SCENE — a derived host for Sylva Living World

   Adapted from @designcodeio/threeui's SylvaLivingWorldScene. The
   package is the SOURCE of the assets, never a runtime dependency:
   nothing here imports from it, and the three.js runtime is inlined
   into the sandboxed document rather than fetched.

   The authored lifecycle is carried across unchanged, because all of it
   is load-bearing:

   - The scene lives in an iframe with srcDoc and sandbox="allow-scripts"
     ONLY. No allow-same-origin, so the document cannot reach this page.
   - It mounts on an IntersectionObserver, so the WebGL context and its
     ~800 KB of inlined source are not built until Projects is near.
   - It unmounts when the tab is hidden, via visibilitychange.
   - Reduced motion is handled by patching the authored render loop so it
     paints exactly one frame instead of scheduling more.
   - The iframe is keyed on the motion preference, so switching it
     rebuilds the document rather than leaving a stale loop running.

   WHAT IS DIFFERENT FROM THE PACKAGE VERSION: the imported document is
   the derived Sakura presentation, and the three hardcoded #4a4d44
   greens become the reference's plum. Nothing else.

   NOT A VARIANT SWITCH. @designcodeio/threeui@1.2.0 ships one variant,
   "living-green" — its `variant` prop is declared in the types and never
   read by the component. The Sakura appearance is a retint applied to
   the source document by scripts/sakura-scene.mjs; the reasoning and
   every changed colour are listed there.
   ================================================================== */

/* NOTHING HERE PAINTS A BACKGROUND ANY MORE, AND THAT IS THE POINT.

   The scene layer sits ABOVE the project cards so the real bark pixels
   occlude them. Every surface between the cards and the canvas therefore
   has to be see-through, or the cards are simply buried: the host div,
   the iframe, the scene document's html and body, and the authored
   .hero ground.

   This costs nothing visually, because the plum was never coming from
   WebGL in the first place — the authored renderer clears fully
   transparent with setClearColor(0x000000, 0). The ground colour and the
   two radial light pools it sat on are relocated verbatim onto the host
   section in ProjectStack.module.css, below the cards. Same gradients,
   same stops; they changed layer, not value. */

/* The scene, with the source page's own furniture left behind: no dock,
   no headings, no cards, no statistics, no wordmark, no scroll cue.
   Just the authored canvas and the sizing anchor it measures against. */
const SCENE_MAIN =
    '<main class="hero" id="hero">' +
    '<canvas id="scene" role="img" aria-label="A mossy bough in blossom"></canvas>' +
    '<div class="stage" id="stage" aria-hidden="true"></div>' +
    "</main>";

const SCENE_STYLE =
    "<style data-sakura-scene>" +
    /* `color-scheme: normal` IS LOAD-BEARING, and it is the whole reason
       the section rendered as a blank white sheet in the dark theme.

       An iframe's canvas is composited transparently only while the
       embedded document's used color-scheme MATCHES the embedding
       element's. The page sets `color-scheme: dark` on :root in the dark
       theme; this document declared none, so its used scheme was light,
       the two disagreed, and the browser stopped honouring the
       transparent root background and painted an opaque WHITE canvas
       instead. With the scene stacked above the cards, that sheet hid the
       cards, the stems and the plum ground — everything except the
       heading, which sits above the scene. In the light theme the two
       agreed, so it looked perfect, which is exactly why six widths of
       checks all missed it.

       Pinning both sides to `normal` makes them agree in BOTH themes
       without rebuilding the document when the theme changes — which
       would restart the authored entrance. It changes no colour in here:
       the scene paints every pixel it shows. */
    "html,body{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;overflow:hidden!important;background:transparent!important;color-scheme:normal!important}" +
    "body{position:relative!important}" +
    ".hero{height:100%!important;min-height:0!important;background:transparent!important}" +
    ".hero::after{background:none!important}" +
    "</style>";

/* The three strings the authored document must still contain. The first
   two bound the slice; the third is the render loop that reduced motion
   patches. scripts/sakura-scene.mjs asserts all three survive the
   retint, and this throws rather than shipping a broken document. */
const MAIN_MARKER = '<main class="hero" id="hero">';
const RUNTIME_MARKER = '<script src="inner-green-assets/three.min.js"></script>';
const LOOP_MARKER = "(function loop() { requestAnimationFrame(loop); tick(); })();";

function buildDocument(reduced: boolean) {
    const mainAt = DOC.indexOf(MAIN_MARKER);
    const runtimeAt = DOC.indexOf(RUNTIME_MARKER);
    if (mainAt < 0 || runtimeAt < 0 || runtimeAt <= mainAt) {
        throw new Error("Sakura scene adapter could not isolate the authored Three.js scene.");
    }

    let doc = `${DOC.slice(0, mainAt)}${SCENE_MAIN}\n\n${DOC.slice(runtimeAt)}`
        .replace("</head>", `${SCENE_STYLE}</head>`)
        .replace(RUNTIME_MARKER, `<script data-three-runtime>${THREE_RUNTIME}</script>`);

    /* One frame, then stop. The authored loop is left otherwise intact,
       so the scene still builds and paints its reveal state — it simply
       never schedules another frame. */
    if (reduced) {
        doc = doc.replace(
            LOOP_MARKER,
            "(function loop() { if (!REDUCED) requestAnimationFrame(loop); tick(); })();",
        );
    }
    return doc;
}

/** What the scene publishes each frame. Coordinates are CSS pixels in
 *  the canvas's own box — never multiplied by device pixel ratio. */
export type AnchorMessage = {
    source: "sakura-anchors";
    /** The canvas's displayed size, so the host can rescale if its
     *  overlay box differs from the canvas box. */
    w: number;
    h: number;
    /** False while the authored scan entrance is still running. */
    entranceDone: boolean;
    anchors: { x: number; y: number; visible: boolean }[];
};



export default function SakuraScene({
    className,
    style,
    onAnchors,
}: {
    className?: string;
    style?: CSSProperties;
    onAnchors?: (msg: AnchorMessage) => void;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLIFrameElement>(null);

    /* Held in a ref so a changing callback never re-runs the listener
       effect — and never remounts the iframe, which would restart the
       authored entrance. */
    const onAnchorsRef = useRef(onAnchors);
    useEffect(() => {
        onAnchorsRef.current = onAnchors;
    }, [onAnchors]);

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            /* The sandbox has no allow-same-origin, so the scene's origin
               is the opaque string "null" and checking e.origin would be
               meaningless. Identity of the sending window is the check
               that actually means something here. */
            const frame = frameRef.current;
            if (!frame || e.source !== frame.contentWindow) return;

            const d = e.data as Partial<AnchorMessage> | null;
            if (
                !d ||
                d.source !== "sakura-anchors" ||
                typeof d.w !== "number" ||
                typeof d.h !== "number" ||
                !Array.isArray(d.anchors) ||
                d.anchors.length !== 4 ||
                !d.anchors.every(
                    (a) =>
                        a && typeof a.x === "number" && typeof a.y === "number" &&
                        typeof a.visible === "boolean",
                )
            ) {
                return;
            }
            onAnchorsRef.current?.(d as AnchorMessage);
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    /* ---- pointer forwarding -----------------------------------------
       The scene sits ABOVE the cards, so the real bark pixels occlude
       them. That means it has to carry `pointer-events: none` — an iframe
       over the cards would otherwise swallow every click meant for one.
       Which also cuts the scene off from its own input, so the host hands
       it the pointer instead.

       The listener is on `window`, NOT on the host element: `.scene` is
       exactly the element we just made pointer-transparent, so it is no
       longer a hit target and nothing dispatched to it would ever arrive.
       Containment is tested against its rect instead.

       Two coordinate systems, because the scene uses two. `pointer`
       drives the camera parallax and the authored listener normalises it
       over the window; `ndc` drives the foliage parting and the spray
       trails, and the authored listener takes it rect-relative to #hero
       with y flipped. The iframe fills the host box, so one rect gives
       both — and the iframe's own window IS that box, so normalising over
       it is what the authored parallax would have computed anyway.

       Coalesced to one message per animation frame. A pointermove can
       fire far more often than that, and posting per event would push
       hundreds of structured clones a second across the sandbox boundary
       for a value the scene reads once per frame. */
    useEffect(() => {
        let raf = 0;
        let queued: { px: number; py: number; nx: number; ny: number } | null = null;
        let inside = false;

        const post = (msg: Record<string, unknown>) => {
            /* No allow-same-origin, so the scene's origin is the opaque
               string "null" and "*" is the only target that can match.
               Nothing secret travels here — two normalised floats. */
            frameRef.current?.contentWindow?.postMessage(msg, "*");
        };

        const flush = () => {
            raf = 0;
            if (!queued) return;
            post({ source: "sakura-pointer", inside: true, ...queued });
            queued = null;
        };

        const leave = () => {
            if (!inside) return;
            inside = false;
            queued = null;
            post({ source: "sakura-pointer", inside: false });
        };

        const onMove = (e: PointerEvent) => {
            /* The authored parallax listener ignores touch, so this does
               too — otherwise a tap would jerk the camera and leave it
               parked wherever the finger lifted. */
            if (e.pointerType === "touch") return;

            const host = hostRef.current;
            const r = host?.getBoundingClientRect();
            if (!r || !r.width || !r.height) return;

            const u = (e.clientX - r.left) / r.width;
            const v = (e.clientY - r.top) / r.height;
            if (u < 0 || u > 1 || v < 0 || v > 1) {
                leave();
                return;
            }

            inside = true;
            queued = { px: u * 2 - 1, py: v * 2 - 1, nx: u * 2 - 1, ny: -(v * 2 - 1) };
            if (!raf) raf = requestAnimationFrame(flush);
        };

        window.addEventListener("pointermove", onMove, { passive: true });
        /* Pointer off the document entirely never produces a move event
           with out-of-rect coordinates, so it needs its own signal. */
        document.addEventListener("pointerleave", leave);
        return () => {
            if (raf) cancelAnimationFrame(raf);
            window.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerleave", leave);
        };
    }, []);

    const [near, setNear] = useState(true);
    const [pageVisible, setPageVisible] = useState(
        () => typeof document === "undefined" || !document.hidden,
    );
    /* The repo's hook, not a local matchMedia read.

       The package's component initialises this from `matchMedia` inside
       a useState initialiser, which cannot survive hydration: the server
       has no media queries and returns false, a reduced-motion client
       returns true, and the two renders then disagree about the whole
       srcDoc. That threw a hydration mismatch into the console on every
       reduced-motion load. useReducedMotion is built on
       useSyncExternalStore, which has a server snapshot for exactly this
       and resolves during the first client render instead. */
    const reduced = useReducedMotion();

    useEffect(() => {
        const el = hostRef.current;
        if (!el || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(([entry]) =>
            setNear(entry?.isIntersecting ?? true),
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") return;
        const onVisibility = () => setPageVisible(!document.hidden);
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, []);


    /* Built once per motion preference. ~800 KB of string concatenation
       is not something to redo on an unrelated rerender. */
    const doc = useMemo(() => buildDocument(reduced), [reduced]);
    const mounted = near && pageVisible;

    return (
        <div
            ref={hostRef}
            className={className}
            style={style}
            /* Decorative in document semantics — the project cards above
               are the content. The label describes the picture for anyone
               who cannot see it. */
            role="img"
            aria-label="A mossy bough in blossom, with drifting petals and a butterfly"
        >
            {mounted ? (
                <iframe
                    ref={frameRef}
                    /* Transparent to the pointer, because it is on top of
                       the cards. Its input arrives by postMessage from the
                       forwarding effect above. */
                    key={reduced ? "reduced" : "motion"}
                    title="A mossy bough in blossom"
                    srcDoc={doc}
                    sandbox="allow-scripts"
                    loading="eager"
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "block",
                        width: "100%",
                        height: "100%",
                        border: 0,
                        background: "transparent",
                        pointerEvents: "none",
                        /* The other half of the match. `color-scheme` is
                           inherited, so without this the iframe element
                           carries the page's `dark` while the document
                           inside says `normal`, and the canvas goes
                           opaque again. Both sides, or neither works. */
                        colorScheme: "normal",
                    }}
                />
            ) : null}
        </div>
    );
}
