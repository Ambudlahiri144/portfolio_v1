"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import {
    VERT,
    FRAG_RIM,
    FRAG_SCENE,
    FRAG_DOWN,
    FRAG_BLUR,
    FRAG_COMP,
} from "./dockfx-shaders";
import styles from "./DockFx.module.css";

/* How far past the dock the canvas extends, in dock heights. The bloom's last
   blur pass reaches roughly four sigma, and anything beyond the canvas is
   simply cut off against a hard rectangle — so this has to clear it. */
const PAD = 1.75;

/* The bloom buffer is downsampled to hold the dock at about this many texels,
   so one set of blur radii produces a glow of the same relative extent at any
   dock size or pixel ratio. */
const GLOW_TEX = 129;

/* The metal field. Order matters — these are flattened into uP[0..20]. */
type Field = Record<string, number>;

const FIELD: Field = {
    valFreq: 0.9,    //  0 x-frequency of the valley curve. Higher than the
    //    reference: the dock is nearly twice as wide
    //    relative to its height, so the same frequency
    //    would leave one lazy curve across the whole thing
    valAmp: 0.3,     //  1 valley depth, in dock heights. Shallower than the
    //    reference: at 0.5 the valley swings the pill's
    //    entire half-height and the band family walks
    //    clean off the top and bottom edges
    dens: 5.5,       //  2 band density — bands per dock height. Far higher than
    //    the reference's 2.4, which at this pill's height
    //    put barely one band across the whole thing and
    //    read as a single smear rather than as ribbons
    densVar: 2.2,    //  3 how much density swings along x
    densFreq: 0.45,  //  4 x-frequency of that swing
    wobAmp: 0.12,    //  5 organic 2-D wobble
    wobFreq: 1.6,    //  6 its frequency
    lift: 0.05,      //  7 phase offset of the band family
    refract: 0.18,   //  8 self-refraction — folds the iso-lines
    edge: 0.04,      //  9 plateau edge softness
    width: 0.46,     // 10 plateau width, fraction of one band period
    disp: 0.3,       // 11 spectral dispersion, in band periods
    skew: 1.5,       // 12 dispersion skew — >1 spreads the blue end
    fineAmp: 0.0,    // 13 filaments: finer than the softening buffer can carry,
    fineFreq: 9.0,   // 14 so they would only alias. Off.
    gamma: 1.0,      // 15 tone gamma
    gain: 0.75,      // 16 overall gain. The reference runs 1.9, but it lights a
    //    pill with one short label on it; widening the lit
    //    envelope above spread that over most of this dock
    //    and buried five icons under blown-white metal
    octGain: 0.32,   // 17 fbm octave gain
    litLo: -0.48,    // 18 where light begins, below the valley. Widened so the
    litHi: -0.02,    // 19 lit region covers most of the pill instead of pooling
    //    into a band along the very bottom edge
    dim: 0.2,        // 20 how far metal is knocked back under the icons. The
    //    icons run the full width of this dock, so there is
    //    nowhere for bright metal to sit unchallenged the way
    //    it can either side of the reference's single label

};

/* The travelling rim — uE[0..7]. This is the part that runs even at rest, and
   it is what makes the dock itself glow. */
/* Brightnesses run well below the reference's.

   That component sits on a near-black #0b0c0e plate with nothing else on the
   page. This dock is translucent glass over a live background, is a fifth the
   width, and is permanently on screen on every route — at the reference's gains
   it blew out into a warm smear that dominated the whole viewport. */
const RIM: Field = {
    base: 0.14,      // 0 floor brightness, so the whole outline stays drawn
    hot: 0.55,       // 1 gain on the travelling highlights
    chromA: 0.42,    // 2 chromatic offset across the stroke, device px
    chromS: 0.03,    // 3 chromatic offset along the perimeter, in laps
    speed: 0.07,     // 4 laps per second
    top: 0.35,       // 5 how much the rim stays biased to the top edge
    press: 0.85,     // 6 outline lift while held
    ripple: 1.6,     // 7 extra flare as a crest crosses the outline
};

const FIELD_KEYS = Object.keys(FIELD);
const RIM_KEYS = Object.keys(RIM);

/* Composite. */
const COMP = {
    glow: 0.85,      // outer-glow gain — see the note on RIM above
    glowR: 1.15,     // glow radius, in the normalised bloom buffer
    glowIn: 0.22,    // how much bloom is allowed back inside the pill
    /* Blur on the metal, in dock heights. The reference's 0.24 is ~14px here,
       which merged every ribbon into one wash; this keeps them distinguishable
       while still reading as molten rather than etched. */
    soften: 0.11,
    punch: 1.5,      // contrast curve on the softened metal; 1 = off
};

/* Disturbances — distances in dock heights, times in seconds. */
const DIST = {
    speed: 2.6,      // ring expansion. Faster than the reference so a press
    //   still crosses this much wider pill in about a second
    width: 0.2,
    decay: 1.35,
    amp: 1.35,
    facet: 0.18,
    lobes: 6.0,
    sharp: 1.15,
    emit: 0.45,
    ptrRad: 0.55,
    ptrAmp: 0.32,
    ptrFast: 0.4,
    ptrRim: 0.8,
    ptrLag: 0.0016,
    ptrVref: 4.5,
};

/* Per-theme intensity.

   The whole effect is additive light. Against the near-black dock of a dark
   theme that reads as molten metal; against a light theme's near-white glass
   there is very little headroom left to add to, so everything is pulled well
   down and the effect becomes a faint iridescence rather than a glow. */
const THEME = {
    dark: { gain: 1.0, rim: 1.0, glow: 1.0 },
    light: { gain: 0.55, rim: 0.42, glow: 0.34 },
};

export default function DockFx({
    targetRef,
}: {
    targetRef: RefObject<HTMLElement | null>;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const reduced = useReducedMotion();

    useEffect(() => {
        const cv = canvasRef.current;
        const dock = targetRef.current;
        if (!cv || !dock) return;

        const gl = cv.getContext("webgl2", {
            alpha: true,
            antialias: false,
            premultipliedAlpha: true,
            powerPreference: "low-power",
        });
        /* No WebGL2, no effect. The dock is fully functional without it — this
           layer only ever adds light on top of the CSS glass. */
        if (!gl) return;

        /* ---- program plumbing ---- */
        const shaders: WebGLShader[] = [];
        const programs: WebGLProgram[] = [];

        function compile(type: number, src: string) {
            const s = gl!.createShader(type)!;
            gl!.shaderSource(s, src);
            gl!.compileShader(s);
            if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
                throw new Error(gl!.getShaderInfoLog(s) ?? "shader compile failed");
            }
            shaders.push(s);
            return s;
        }

        function build(fs: string) {
            const p = gl!.createProgram()!;
            gl!.attachShader(p, compile(gl!.VERTEX_SHADER, VERT));
            gl!.attachShader(p, compile(gl!.FRAGMENT_SHADER, fs));
            gl!.bindAttribLocation(p, 0, "position");
            gl!.linkProgram(p);
            if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) {
                throw new Error(gl!.getProgramInfoLog(p) ?? "link failed");
            }
            programs.push(p);
            const u: Record<string, WebGLUniformLocation | null> = {};
            const n = gl!.getProgramParameter(p, gl!.ACTIVE_UNIFORMS) as number;
            for (let i = 0; i < n; i++) {
                const info = gl!.getActiveUniform(p, i)!;
                u[info.name.replace("[0]", "")] = gl!.getUniformLocation(p, info.name);
            }
            return { p, u };
        }

        let pScene, pRim, pDown, pBlur, pComp;
        try {
            pScene = build(FRAG_SCENE);
            pRim = build(FRAG_RIM);
            pDown = build(FRAG_DOWN);
            pBlur = build(FRAG_BLUR);
            pComp = build(FRAG_COMP);
        } catch {
            /* A driver that refuses one of these should cost the page nothing
               more than the missing glow. */
            return;
        }

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]),
            gl.STATIC_DRAW,
        );
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        const hasFloat = !!gl.getExtension("EXT_color_buffer_half_float");

        type Target = {
            tex: WebGLTexture;
            fbo: WebGLFramebuffer;
            w: number;
            h: number;
        };
        const targets: Target[] = [];

        function makeTarget(): Target {
            const tex = gl!.createTexture()!;
            gl!.bindTexture(gl!.TEXTURE_2D, tex);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
            const fbo = gl!.createFramebuffer()!;
            gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
            gl!.framebufferTexture2D(
                gl!.FRAMEBUFFER,
                gl!.COLOR_ATTACHMENT0,
                gl!.TEXTURE_2D,
                tex,
                0,
            );
            const t = { tex, fbo, w: 0, h: 0 };
            targets.push(t);
            return t;
        }

        function sizeTarget(t: Target, w: number, h: number) {
            if (t.w === w && t.h === h) return;
            t.w = w;
            t.h = h;
            gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
            if (hasFloat) {
                gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA16F, w, h, 0, gl!.RGBA, gl!.HALF_FLOAT, null);
            } else {
                gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, w, h, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
            }
        }

        const T_core = makeTarget();
        const T_rim = makeTarget();
        const T_s1 = makeTarget();
        const T_s2 = makeTarget();
        const T_a = makeTarget();
        const T_b = makeTarget();

        /* ---- geometry ---- */
        let W = 0, H = 0, BW = 0, BH = 0, CX = 0, CY = 0, DOWN = 4;
        let needResize = true;

        /* The dock's LAYOUT size, which is not what getBoundingClientRect gives.

           The dock enters with a `dockIn` keyframe that holds it at
           scale3d(0.94) through a 1.35s delay, and getBoundingClientRect reports
           the transformed box. Measuring there returned 55.2px for a 58.8px
           dock, so the shader drew its pill ~1.8px inside the real edge and the
           CSS border showed as a second outline just outside the coloured rim.

           ResizeObserver never corrected it either: it reports layout box
           changes, and a transform finishing is not one — so the wrong size
           stuck for the life of the page. borderBoxSize is the layout box and
           ignores transforms entirely, which is exactly what is wanted here.
           The canvas is a child of the dock, so it inherits the same transform
           and the two stay aligned throughout the entrance animation. */
        let layoutW = dock.offsetWidth;
        let layoutH = dock.offsetHeight;

        function resize() {
            if (layoutW < 1 || layoutH < 1) return;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const pad = layoutH * PAD;

            /* Absolute offsets resolve against the dock's PADDING box, but the
               pill the shader draws is its BORDER box — so the border width has
               to come back out or the canvas sits a pixel low and right. */
            const cs = getComputedStyle(dock!);
            const bl = parseFloat(cs.borderLeftWidth) || 0;
            const bt = parseFloat(cs.borderTopWidth) || 0;

            /* The element's own box is driven from here rather than from CSS.
               A percentage inset would resolve against the dock's width on both
               axes, which on a pill this wide gives a hugely lopsided canvas;
               and deriving the CSS box and the pixel buffer from the same
               measurement is the only way they cannot drift apart. */
            cv!.style.left = `${-pad - bl}px`;
            cv!.style.top = `${-pad - bt}px`;
            cv!.style.width = `${layoutW + pad * 2}px`;
            cv!.style.height = `${layoutH + pad * 2}px`;

            const cssW = layoutW + pad * 2;
            const cssH = layoutH + pad * 2;
            const w = Math.max(2, Math.round(cssW * dpr));
            const h = Math.max(2, Math.round(cssH * dpr));

            if (w !== W || h !== H) {
                W = w;
                H = h;
                cv!.width = W;
                cv!.height = H;
            }
            BW = layoutW * dpr;
            BH = layoutH * dpr;
            CX = W / 2;
            CY = H / 2;

            sizeTarget(T_core, W, H);
            sizeTarget(T_rim, W, H);
            const hw = Math.max(2, Math.ceil(W / 2));
            const hh = Math.max(2, Math.ceil(H / 2));
            sizeTarget(T_s1, hw, hh);
            sizeTarget(T_s2, hw, hh);
            DOWN = Math.max(1, Math.min(4, Math.round(BH / GLOW_TEX)));
            sizeTarget(T_a, Math.max(2, Math.ceil(W / DOWN)), Math.max(2, Math.ceil(H / DOWN)));
            sizeTarget(T_b, Math.max(2, Math.ceil(W / DOWN)), Math.max(2, Math.ceil(H / DOWN)));
            needResize = false;
        }

        const ro = new ResizeObserver((entries) => {
            const box = entries[0]?.borderBoxSize?.[0];
            if (box) {
                layoutW = box.inlineSize;
                layoutH = box.blockSize;
            } else {
                layoutW = dock.offsetWidth;
                layoutH = dock.offsetHeight;
            }
            needResize = true;
        });
        /* Fires once on observe with the current size, so the fractional layout
           box lands before the first frame rather than the rounded offset*. */
        ro.observe(dock);

        function drawTo(t: Target | null) {
            gl!.bindFramebuffer(gl!.FRAMEBUFFER, t ? t.fbo : null);
            gl!.viewport(0, 0, t ? t.w : W, t ? t.h : H);
            gl!.drawArrays(gl!.TRIANGLES, 0, 3);
        }

        /* ---- theme ---- */
        let tone = THEME.dark;
        const readTheme = () => {
            tone =
                document.documentElement.dataset.theme === "light"
                    ? THEME.light
                    : THEME.dark;
        };
        readTheme();
        const mo = new MutationObserver(readTheme);
        mo.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        /* ---- state ---- */
        const fieldArr = new Float32Array(FIELD_KEYS.length);
        const rimArr = new Float32Array(RIM_KEYS.length);

        let hover = 0, hoverTarget = 0;
        let press = 0, pressTarget = 0;
        let clock = 0;
        let last = performance.now();

        const RIP = [0, 1, 2].map(() => ({ x: 0, y: 0, t: -99, on: 0 }));
        const ripBuf = new Float32Array(12);
        let ripNext = 0;

        const ptr = { x: 0, y: 0 };
        const ptrS = { x: 0, y: 0 };
        let ptrAmt = 0, ptrSpeed = 0;

        const on = { over: false, press: false, focus: false };

        function localPt(e: PointerEvent): [number, number] {
            const b = dock!.getBoundingClientRect();
            const s = b.height;
            return [
                (e.clientX - (b.left + b.width / 2)) / s,
                (e.clientY - (b.top + b.height / 2)) / s,
            ];
        }

        function addRipple(x: number, y: number) {
            const r = RIP[ripNext];
            ripNext = (ripNext + 1) % RIP.length;
            r.x = x;
            r.y = y;
            r.t = clock;
            r.on = 1;
        }

        const sync = () => {
            hoverTarget = on.over || on.press || on.focus ? 1 : 0;
            pressTarget = on.press ? 1 : 0;
        };

        /* ---- events, all on the dock itself ---- */
        /* Assigned field by field rather than with `[ptr.x, ptr.y] = localPt(e)`.
           Destructuring into member expressions is legal JavaScript, but SWC
           emits something the build then rejects with "Invalid destructuring
           assignment target" — it fails at prerender, not at typecheck. */
        function setPtr(e: PointerEvent) {
            const [x, y] = localPt(e);
            ptr.x = x;
            ptr.y = y;
        }

        const onEnter = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            /* Land the well where the cursor actually entered, not where it was
               when it last left — otherwise it visibly slingshots across. */
            setPtr(e);
            ptrS.x = ptr.x;
            ptrS.y = ptr.y;
            ptrSpeed = 0;
            on.over = true;
            sync();
        };
        const onLeave = (e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            on.over = false;
            sync();
        };
        const onMove = (e: PointerEvent) => {
            if (!on.over && !on.press) return;
            setPtr(e);
        };
        const onDown = (e: PointerEvent) => {
            setPtr(e);
            on.press = true;
            sync();
            addRipple(ptr.x, ptr.y);
        };
        const onUp = () => {
            on.press = false;
            sync();
        };
        /* Focus is tracked on the dock as a whole via capture, so tabbing
           between the five controls keeps it lit instead of flickering. */
        const onFocusIn = () => {
            on.focus = !!dock!.querySelector(":focus-visible");
            sync();
        };
        const onFocusOut = () => {
            on.focus = false;
            sync();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            if (e.repeat) return;
            addRipple(0, 0);
        };

        dock.addEventListener("pointerenter", onEnter);
        dock.addEventListener("pointerleave", onLeave);
        dock.addEventListener("pointerdown", onDown);
        dock.addEventListener("focusin", onFocusIn);
        dock.addEventListener("focusout", onFocusOut);
        dock.addEventListener("keydown", onKey);
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);

        /* ---- frame ---- */
        let raf = 0;

        function setCommon(u: Record<string, WebGLUniformLocation | null>) {
            gl!.uniform2f(u.uC, CX, CY);
            gl!.uniform2f(u.uHalf, BW / 2, BH / 2);
            gl!.uniform1f(u.uT, clock);
            gl!.uniform1f(u.uPress, press);
            gl!.uniform4fv(u.uRip, ripBuf);
            gl!.uniform4f(u.uRipK, DIST.speed, DIST.width, DIST.decay, DIST.amp);
            gl!.uniform4f(u.uRipK2, DIST.facet, DIST.lobes, DIST.sharp, DIST.emit);
            gl!.uniform4f(u.uPtr, ptrS.x, ptrS.y, ptrAmt, ptrSpeed);
            gl!.uniform4f(u.uPtrK, DIST.ptrRad, DIST.ptrAmp, DIST.ptrFast, DIST.ptrRim);
        }

        function frame(now: number) {
            raf = requestAnimationFrame(frame);

            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            clock += dt;

            // asymmetric ease: quick to bloom, slower to die
            const hk =
                hoverTarget > hover
                    ? 1 - Math.pow(0.0012, dt)
                    : 1 - Math.pow(0.00012, dt);
            hover += (hoverTarget - hover) * hk;
            if (Math.abs(hoverTarget - hover) < 0.0008) hover = hoverTarget;

            const pk =
                pressTarget > press ? 1 - Math.pow(1e-9, dt) : 1 - Math.pow(0.004, dt);
            press += (pressTarget - press) * pk;
            if (Math.abs(pressTarget - press) < 0.002) press = pressTarget;

            for (let i = 0; i < RIP.length; i++) {
                const r = RIP[i];
                if (r.on && clock - r.t > 4) r.on = 0;
                ripBuf[i * 4] = r.x;
                ripBuf[i * 4 + 1] = r.y;
                ripBuf[i * 4 + 2] = r.t;
                ripBuf[i * 4 + 3] = r.on;
            }

            // the well trails the cursor and swells with how fast it is dragged
            const lag = 1 - Math.pow(DIST.ptrLag, dt);
            const dx = (ptr.x - ptrS.x) * lag;
            const dy = (ptr.y - ptrS.y) * lag;
            ptrS.x += dx;
            ptrS.y += dy;
            const inst = Math.min(
                Math.hypot(dx, dy) / Math.max(dt, 1e-3) / DIST.ptrVref,
                1,
            );
            ptrSpeed +=
                (inst - ptrSpeed) *
                (1 - Math.pow(inst > ptrSpeed ? 0.001 : 0.02, dt));
            const wantWell = on.over || on.press ? 1 : 0;
            ptrAmt += (wantWell - ptrAmt) * (1 - Math.pow(0.004, dt));
            if (Math.abs(wantWell - ptrAmt) < 0.002) ptrAmt = wantWell;

            if (needResize) resize();
            if (!W || !H || !BW) return;

            for (let i = 0; i < fieldArr.length; i++) fieldArr[i] = FIELD[FIELD_KEYS[i]];
            fieldArr[16] = FIELD.gain * tone.gain;
            for (let i = 0; i < rimArr.length; i++) rimArr[i] = RIM[RIM_KEYS[i]];
            rimArr[1] = RIM.hot * tone.rim;
            rimArr[0] = RIM.base * tone.rim;

            const bw = Math.max(1.2, 3.2 * (BH / 516));

            // 1. metal, masked to the pill. The shader early-outs when hover is
            //    ~0, so the 21-tap dispersion loop costs nothing at rest.
            gl!.useProgram(pScene!.p);
            setCommon(pScene!.u);
            gl!.uniform1f(pScene!.u.uHover, hover);
            gl!.uniform1fv(pScene!.u.uP, fieldArr);
            drawTo(T_core);

            // 2. rim, kept out of the softening blur so the outline stays thin
            gl!.useProgram(pRim!.p);
            setCommon(pRim!.u);
            gl!.uniform1f(pRim!.u.uHover, hover);
            gl!.uniform1f(pRim!.u.uBw, bw);
            gl!.uniform1fv(pRim!.u.uE, rimArr);
            drawTo(T_rim);

            // 3. soften the metal. Skipped entirely at rest — with hover at zero
            //    T_core is black inside the mask and there is nothing to blur.
            gl!.useProgram(pDown!.p);
            gl!.activeTexture(gl!.TEXTURE0);
            gl!.bindTexture(gl!.TEXTURE_2D, T_core.tex);
            gl!.uniform1i(pDown!.u.uTex, 0);
            gl!.uniform1f(pDown!.u.uAdd, 0);
            gl!.uniform2f(pDown!.u.uDstTexel, 1 / T_s1.w, 1 / T_s1.h);
            drawTo(T_s1);

            if (hover > 0.002) {
                gl!.useProgram(pBlur!.p);
                gl!.uniform1i(pBlur!.u.uTex, 0);
                gl!.uniform2f(pBlur!.u.uTexel, 1 / T_s1.w, 1 / T_s1.h);
                /* One very wide pass leaves comb ghosts — the taps end up further
                   apart than the sigma they describe — so it is split into passes
                   whose radii add in quadrature. */
                const sigTex = COMP.soften * (BH * 0.5) * 0.95;
                if (sigTex > 0.1) {
                    const iters = Math.min(4, Math.max(1, Math.ceil(sigTex / 3)));
                    gl!.uniform1f(pBlur!.u.uR, sigTex / Math.sqrt(iters) / 1.95);
                    for (let i = 0; i < iters; i++) {
                        gl!.bindTexture(gl!.TEXTURE_2D, T_s1.tex);
                        gl!.uniform2f(pBlur!.u.uDir, 1, 0);
                        drawTo(T_s2);
                        gl!.bindTexture(gl!.TEXTURE_2D, T_s2.tex);
                        gl!.uniform2f(pBlur!.u.uDir, 0, 1);
                        drawTo(T_s1);
                    }
                }
            }

            // 4. bloom, fed by the softened metal plus the crisp rim
            gl!.useProgram(pDown!.p);
            gl!.activeTexture(gl!.TEXTURE0);
            gl!.bindTexture(gl!.TEXTURE_2D, T_s1.tex);
            gl!.activeTexture(gl!.TEXTURE1);
            gl!.bindTexture(gl!.TEXTURE_2D, T_rim.tex);
            gl!.uniform1i(pDown!.u.uTex, 0);
            gl!.uniform1i(pDown!.u.uTex2, 1);
            gl!.uniform1f(pDown!.u.uAdd, 1);
            gl!.uniform2f(pDown!.u.uDstTexel, 1 / T_a.w, 1 / T_a.h);
            drawTo(T_a);

            gl!.useProgram(pBlur!.p);
            gl!.activeTexture(gl!.TEXTURE0);
            gl!.uniform1i(pBlur!.u.uTex, 0);
            gl!.uniform2f(pBlur!.u.uTexel, 1 / T_a.w, 1 / T_a.h);
            const rs = (COMP.glowR * (BH / DOWN)) / GLOW_TEX;
            for (const step of [1.0, 2.3, 5.2, 9.0]) {
                gl!.uniform1f(pBlur!.u.uR, step * rs);
                gl!.bindTexture(gl!.TEXTURE_2D, T_a.tex);
                gl!.uniform2f(pBlur!.u.uDir, 1, 0);
                drawTo(T_b);
                gl!.bindTexture(gl!.TEXTURE_2D, T_b.tex);
                gl!.uniform2f(pBlur!.u.uDir, 0, 1);
                drawTo(T_a);
            }

            // 5. composite
            gl!.useProgram(pComp!.p);
            setCommon(pComp!.u);
            gl!.uniform1f(pComp!.u.uHover, hover);
            gl!.activeTexture(gl!.TEXTURE0);
            gl!.bindTexture(gl!.TEXTURE_2D, T_s1.tex);
            gl!.uniform1i(pComp!.u.uSoft, 0);
            gl!.activeTexture(gl!.TEXTURE1);
            gl!.bindTexture(gl!.TEXTURE_2D, T_rim.tex);
            gl!.uniform1i(pComp!.u.uRim, 1);
            gl!.activeTexture(gl!.TEXTURE2);
            gl!.bindTexture(gl!.TEXTURE_2D, T_a.tex);
            gl!.uniform1i(pComp!.u.uGlow, 2);
            gl!.uniform2f(pComp!.u.uRes, W, H);
            gl!.uniform1f(pComp!.u.uGlowGain, COMP.glow * tone.glow);
            gl!.uniform1f(pComp!.u.uGlowIn, COMP.glowIn);
            gl!.uniform1f(pComp!.u.uDim, FIELD.dim);
            gl!.uniform1f(pComp!.u.uPunch, COMP.punch);
            drawTo(null);
        }

        resize();
        raf = requestAnimationFrame(frame);

        /* ---- teardown ---- */
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            mo.disconnect();
            dock.removeEventListener("pointerenter", onEnter);
            dock.removeEventListener("pointerleave", onLeave);
            dock.removeEventListener("pointerdown", onDown);
            dock.removeEventListener("focusin", onFocusIn);
            dock.removeEventListener("focusout", onFocusOut);
            dock.removeEventListener("keydown", onKey);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);

            /* GPU memory is not reclaimed by React. Without this, every client
               navigation that remounts the dock leaks a full set of targets. */
            for (const t of targets) {
                gl.deleteTexture(t.tex);
                gl.deleteFramebuffer(t.fbo);
            }
            for (const p of programs) gl.deleteProgram(p);
            for (const s of shaders) gl.deleteShader(s);
            gl.deleteBuffer(vbo);
            gl.deleteVertexArray(vao);

            /* Deliberately NOT calling WEBGL_lose_context here.

               A canvas hands back the same context object every time, and losing
               it is permanent. StrictMode runs effects mount → cleanup → mount in
               development, so killing the context on the first cleanup left the
               second mount holding a dead one and the dock rendered nothing at
               all. Deleting the resources above is enough; the context goes with
               the canvas when React drops it. */
        };
    }, [targetRef, reduced]);

    /* Nothing is rendered at all under reduced motion — no canvas, no context,
       no frame loop. The dock keeps its CSS glass and reads exactly as before. */
    if (reduced) return null;

    return <canvas ref={canvasRef} className={styles.fx} aria-hidden="true" />;
}
