"use client";

import { useEffect, useRef, useState } from "react";
import { createTempleNightRenderer } from "./templeNightRenderer.js";
/* Plain stylesheet, not a CSS module: the class names are the authored
   ones and the renderer's own markup uses them verbatim. Imported here
   rather than globally so it travels with the only component that needs
   it. */
import "./styles.css";

/* ==================================================================
   TEMPLE NIGHT · sakura-moon

   A mountain shrine under a full rose moon: cherry canopy on both
   flanks, stone lanterns up a long flight, one warm amber accent in an
   otherwise violet field. Everything is generated at runtime — every
   texture, from the bark and the tile to the lunar disc and the cut-out
   foreground plates, is painted to a 2-D canvas at load. There are no
   image assets.

   ONE VARIANT, NOT FOUR. The authored host reached three sibling worlds
   — a Yosemite valley, a Presidio headland, Lake Louise at dusk — as
   lazily-loaded variants of this component. None of them ships in
   @designcodeio/threeui@1.2.0: each needs its own theme module and its
   own world section, and neither exists. The lazy imports are therefore
   removed rather than left pointing at files that are not there, where
   they would fail at runtime instead of at build time.

   THE RENDERER IS GENERATED, NOT HAND-COPIED. templeNightRenderer.js is
   written by scripts/temple-night.mjs out of the vendored Kage source;
   every difference from that source is a named, asserted edit in the
   script. Do not edit the module directly — it is overwritten.
   ================================================================== */

type Renderer = ReturnType<typeof createTempleNightRenderer>;

/** Where the lifted near-garden reaches, as the renderer measured it: for
 *  each of `top.length` equal columns across the canvas, the highest opaque
 *  row, in the canvas's own CSS pixels (`height` when a column is empty). */
export type ForegroundBounds = { width: number; height: number; top: number[] };

export function TempleNightScene({
    className = "",
    foregroundClassName,
    liftForeground = true,
    onForegroundBounds,
}: {
    className?: string;
    /* Opt-in. When given, the plates nearest the lens are drawn into a
       second, transparent layer that is rendered as a SIBLING of the scene,
       so the page can put its own content between the two. A child of the
       scene would be trapped in the scene's stacking context (it isolates
       and contains paint) and could never rise above anything the page
       stacks over the scene. The layer is decorative: pointer-transparent
       and hidden from assistive technology. */
    foregroundClassName?: string;
    /* Whether the near plates are currently drawn above the page's content.
       Switchable at runtime: off, they go back into the world's own pass. */
    liftForeground?: boolean;
    /* Called with where the lifted grass reaches, once the scene has settled
       — on becoming visible, after a resize, after the lift changes — so the
       page can keep its own content clear of it. Never per frame: each call
       costs a small GPU read-back. */
    onForegroundBounds?: (bounds: ForegroundBounds) => void;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const fgHostRef = useRef<HTMLDivElement>(null);
    /* Read by the mount effect, which must not re-run on a prop change — it
       would rebuild the whole world (it re-runs only to recover from a lost
       context). So props it needs are mirrored here. */
    const liftRef = useRef(liftForeground);
    const onBoundsRef = useRef(onForegroundBounds);
    const controlRef = useRef<{ setLift: (on: boolean) => void } | null>(null);
    /* Whether THIS mount owns a second canvas. A lift with nowhere to draw
       needs a rebuild; a lift turned off does not, so a viewport dragged
       back and forth across the breakpoint rebuilds at most once. */
    const hasForegroundRef = useRef(false);
    /* Rebuilds are capped. Recovery allocates two fresh contexts, so a
       machine that is losing them under pressure must not be answered with
       an endless supply of new ones — after a few tries the section settles
       for the still fallback instead of fighting the GPU. */
    const rebuildsRef = useRef(0);
    const MAX_REBUILDS = 3;

    useEffect(() => {
        onBoundsRef.current = onForegroundBounds;
    }, [onForegroundBounds]);

    useEffect(() => {
        liftRef.current = liftForeground;
        if (liftForeground && !hasForegroundRef.current) {
            /* Nothing to lift into: this mount was built without the second
               canvas, because the screen was too narrow to want one. */
            if (rebuildsRef.current < MAX_REBUILDS) {
                rebuildsRef.current += 1;
                setGeneration((g) => g + 1);
            }
            return;
        }
        controlRef.current?.setLift(liftForeground);
    }, [liftForeground]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
    const [errorMessage, setErrorMessage] = useState("");
    /* Bumped when a lost context comes back. three cannot re-upload its GPU
       resources into a restored context, so recovery is a fresh world on
       fresh canvases — the mount effect simply runs again. */
    const [generation, setGeneration] = useState(0);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return undefined;

        /* A NEW CANVAS FOR EVERY MOUNT, created here rather than in JSX.

           dispose() ends with forceContextLoss(), which is what actually
           hands the GPU context back — but a lost context is lost for good,
           on that element, forever. React Strict Mode mounts, unmounts and
           mounts again in development, and when the canvas was JSX the
           second mount got the SAME element: three asked its dead context
           for shader precision, got null, and the section showed
           "Cannot read properties of null (reading 'precision')". Production
           never double-mounts, which is why that only ever appeared on the
           dev server. Owning the element per mount means a disposed canvas
           is never reused, in dev or on any real remount. */
        const canvas = document.createElement("canvas");
        canvas.className = "temple-night-canvas";
        canvas.setAttribute(
            "aria-label",
            "Interactive mountain shrine under a full moon, with falling cherry blossom",
        );
        host.prepend(canvas);
        canvasRef.current = canvas;

        /* The foreground canvas follows the same rule, for the same reason:
           it is a second WebGL context, disposed with the first.

           ONLY WHEN THE LIFT IS ON. A context is a scarce, page-wide
           resource — the browser refuses the next request once too many are
           live, and refuses the whole world, not just the extra. A phone
           never lifts the near garden, so a phone should never be holding a
           second context for it. */
        const fgHost = fgHostRef.current;
        const fgCanvas = fgHost && liftRef.current ? document.createElement("canvas") : null;
        hasForegroundRef.current = !!fgCanvas;
        if (fgHost && fgCanvas) {
            fgCanvas.className = "temple-night-canvas";
            fgHost.prepend(fgCanvas);
        }

        let renderer: Renderer | undefined;
        let retryTimer = 0;
        try {
            renderer = createTempleNightRenderer(canvas, { foregroundCanvas: fgCanvas });
        } catch (error) {
            canvas.remove();
            fgCanvas?.remove();
            hasForegroundRef.current = false;
            canvasRef.current = null;
            setErrorMessage(error instanceof Error ? error.message : "Unknown renderer error");
            setState("unavailable");
            /* A REFUSED CONTEXT IS NOT A VERDICT ON THE BROWSER. It usually
               means the page is holding as many as it is allowed to, right
               now — during React's development double mount, or while the
               projects world above is still winding down. Those come back.
               So a refusal is retried a few times, spaced out, and only then
               left as the still fallback. */
            const retryable =
                typeof error === "object" && error !== null && "retryable" in error;
            if (retryable && rebuildsRef.current < MAX_REBUILDS) {
                rebuildsRef.current += 1;
                const wait = 600 * rebuildsRef.current;
                retryTimer = window.setTimeout(
                    () => setGeneration((g) => g + 1),
                    wait,
                );
                return () => window.clearTimeout(retryTimer);
            }
            return undefined;
        }
        if (!renderer) {
            setState("unavailable");
            return undefined;
        }
        const world = renderer;
        world.setForegroundLift(liftRef.current);

        /* ---- measuring the near garden -------------------------------
           Only when the frame is settled, because the grass line depends on
           the camera: the world stops rendering while it is off-screen, and
           this section is the last on the page, so a measurement taken at
           load would read the camera's pre-intro pose rather than where it
           comes to rest. Hence "soon after it becomes visible", with the
           intro's own 2.4s honoured if the visitor arrives inside it. */
        const mountedAt = performance.now();
        let measureTimer = 0;
        const measureSoon = (delay: number) => {
            if (!fgCanvas) return;
            window.clearTimeout(measureTimer);
            measureTimer = window.setTimeout(() => {
                if (disposed) return;
                const bounds = world.measureForeground();
                if (bounds) onBoundsRef.current?.(bounds);
            }, delay);
        };
        const settleDelay = () =>
            Math.max(450, 3000 - (performance.now() - mountedAt));

        let frame = 0;
        let steadyTimer = 0;
        let visible = true;
        let disposed = false;
        let rendered = false;

        const schedule = () => {
            if (!disposed && visible && !document.hidden && !frame) {
                frame = requestAnimationFrame(render);
            }
        };
        const render = (time: number) => {
            frame = 0;
            world.render(time);
            if (!rendered) {
                rendered = true;
                /* On the element directly: it is not JSX any more, so a
                   className derived from state would never reach it. */
                canvas.classList.add("is-ready");
                fgCanvas?.classList.add("is-ready");
                setState("ready");
                /* A world that then runs for a while has earned its recovery
                   budget back: that was an episode, not a pattern. Without
                   this, three unlucky moments spread over a long visit would
                   permanently retire the scene. */
                steadyTimer = window.setTimeout(() => {
                    rebuildsRef.current = 0;
                }, 10000);
            }
            /* Reduced motion paints one frame and stops. The scene still
               builds and still reveals; it simply never asks for another. */
            if (!world.reducedMotion) schedule();
        };
        const resize = () => {
            world.resize();
            schedule();
            measureSoon(Math.max(300, settleDelay() - 150));
        };
        /* REDUCED MOTION IGNORES THE POINTER ENTIRELY.

           Every frame advances the world's clock — up to 50ms each, which is
           the renderer's own step cap — and the authored host scheduled a
           frame on every pointer event and on window blur. So under reduced
           motion, sweeping the cursor across the scene's exposed edges
           stepped the petals, the haze and the parallax forward one tick
           per event: animation driven by the mouse, for exactly the visitors
           who asked for none. Measured as two frames differing across 88%
           of pixels with nothing else happening. Parallax is motion; there
           is no still-frame version of it to fall back to. */
        const setPointer = (event: PointerEvent) => {
            if (world.reducedMotion) return;
            const bounds = canvas.getBoundingClientRect();
            const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1;
            const y = 1 - ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2;
            world.setPointer(x, y, true);
            schedule();
        };
        const clearPointer = () => {
            if (world.reducedMotion) return;
            world.setPointer(0, 0, false);
            schedule();
        };
        const onVisibility = () => {
            if (document.hidden && frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            } else {
                schedule();
            }
        };

        /* WebGL contexts are reclaimed under memory pressure and on GPU driver
           resets. Without this the canvas simply goes black and stays black,
           which is indistinguishable from a broken page. */
        const lostContexts = new Set<EventTarget>();
        const onContextLost = (event: Event) => {
            /* preventDefault is what makes the browser offer a restore. */
            event.preventDefault();
            if (event.target) lostContexts.add(event.target);
            if (frame) { cancelAnimationFrame(frame); frame = 0; }
            canvas.classList.remove("is-ready");
            fgCanvas?.classList.remove("is-ready");
            setErrorMessage("graphics context lost");
            setState("unavailable");
        };
        /* Rebuild only once every lost context is back: the frame needs both. */
        const onContextRestored = (event: Event) => {
            if (event.target) lostContexts.delete(event.target);
            if (lostContexts.size || disposed) return;
            if (rebuildsRef.current >= MAX_REBUILDS) return;
            rebuildsRef.current += 1;
            setErrorMessage("");
            setState("loading");
            setGeneration((g) => g + 1);
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        const intersectionObserver = new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (!visible && frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            } else {
                schedule();
                if (visible) measureSoon(settleDelay());
            }
        });
        intersectionObserver.observe(host);
        canvas.addEventListener("pointermove", setPointer, { passive: true });
        canvas.addEventListener("pointerenter", setPointer, { passive: true });
        canvas.addEventListener("pointerleave", clearPointer, { passive: true });
        canvas.addEventListener("webglcontextlost", onContextLost);
        /* Either context going means the frame cannot be drawn honestly:
           a world with no foreground, or a foreground over a dead world. */
        fgCanvas?.addEventListener("webglcontextlost", onContextLost);
        canvas.addEventListener("webglcontextrestored", onContextRestored);
        fgCanvas?.addEventListener("webglcontextrestored", onContextRestored);
        window.addEventListener("blur", clearPointer);
        document.addEventListener("visibilitychange", onVisibility);
        controlRef.current = {
            setLift: (on: boolean) => {
                world.setForegroundLift(on);
                schedule();
                if (on) measureSoon(300);
            },
        };
        resize();

        return () => {
            disposed = true;
            controlRef.current = null;
            window.clearTimeout(measureTimer);
            window.clearTimeout(steadyTimer);
            if (frame) cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            intersectionObserver.disconnect();
            canvas.removeEventListener("pointermove", setPointer);
            canvas.removeEventListener("pointerenter", setPointer);
            canvas.removeEventListener("pointerleave", clearPointer);
            canvas.removeEventListener("webglcontextlost", onContextLost);
            fgCanvas?.removeEventListener("webglcontextlost", onContextLost);
            canvas.removeEventListener("webglcontextrestored", onContextRestored);
            fgCanvas?.removeEventListener("webglcontextrestored", onContextRestored);
            window.removeEventListener("blur", clearPointer);
            document.removeEventListener("visibilitychange", onVisibility);
            world.dispose();
            /* The element goes with its context. A canvas whose context has
               been forced lost is unusable, so it must not outlive this mount. */
            canvas.remove();
            fgCanvas?.remove();
            if (canvasRef.current === canvas) canvasRef.current = null;
        };
    }, [generation]);

    return (
        <>
            <div
                className={`temple-night-scene${className ? ` ${className}` : ""}`}
                ref={hostRef}
                data-state={state}
                data-theme="sakura-moon"
            >
                {/* The canvas is inserted by the effect above — see there. */}
                {state === "unavailable" ? (
                    <p className="temple-night-unavailable" role="status">
                        WebGL is unavailable: {errorMessage || "unsupported context"}.
                    </p>
                ) : null}
            </div>
            {/* Present from the first render when asked for, because the
                effect reads it once, at mount, to decide whether to split the
                frame at all. */}
            {foregroundClassName ? (
                <div
                    className={`temple-night-foreground ${foregroundClassName}`}
                    ref={fgHostRef}
                    aria-hidden="true"
                />
            ) : null}
        </>
    );
}

export default TempleNightScene;
