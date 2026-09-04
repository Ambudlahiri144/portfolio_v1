"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

/* ==================================================================
   FOOTER TOPOGRAPHY

   A 1px measuring grid with slow-drifting contour lines over it,
   drawn in WebGL. Adapted from the supplied reference, with three
   changes it needed to live inside this page rather than own it:

   1. Scoped to the footer, not `fixed inset-0`. The reference paints
      the whole viewport for the life of the page; here it is one
      section's background.
   2. Theme aware. The reference is black-only (both snippets supplied
      were identical), so the light variant is derived: the shader now
      mixes between two colours read from the site's own --bg and
      --ink tokens rather than adding white onto black.
   3. Gated on visibility. The reference runs its rAF loop forever.
      This one only runs while the footer is actually on screen, so
      the other twenty thousand pixels of this page cost nothing.
   ================================================================== */

const VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_dpr;
uniform vec3  u_bg;
uniform vec3  u_line;
uniform float u_grid;
uniform float u_topo;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  st.x *= u_resolution.x / u_resolution.y;

  /* Grid ruled in DEVICE pixels, not CSS pixels, so the line stays exactly
     one physical pixel wide on any display instead of blurring to two. */
  float cell = 48.0 * u_dpr;
  vec2  f = fract(gl_FragCoord.xy / cell);
  float t = 1.0 / cell;
  float grid = clamp(step(1.0 - t, f.x) + step(1.0 - t, f.y), 0.0, 1.0) * u_grid;

  /* Contours: sample noise, slice it into bands, and keep only the razor
     edge where a band flips. The triangle wave is what turns a smooth
     gradient into discrete iso-lines. */
  vec2  np  = st * 1.4 + vec2(u_time * 0.015, u_time * 0.025);
  float n   = snoise(np) * 0.5 + 0.5;
  float tri = abs(fract(n * 10.0) - 0.5) * 2.0;
  float topo = smoothstep(0.02, 0.0, tri) * u_topo;

  /* mix(), not add(). Adding white onto black is the reference's approach
     and only works on a dark ground; mixing toward a line colour lets the
     same shader draw dark lines on a light page. */
  gl_FragColor = vec4(mix(u_bg, u_line, clamp(grid + topo, 0.0, 1.0)), 1.0);
}
`;

type Rgb = [number, number, number];

/* The tokens are authored as hex. Reading them at runtime rather than
   duplicating their values here means the background cannot drift out of step
   with globals.css the way HeroCanvas's hardcoded palette could. */
function readHex(value: string, fallback: Rgb): Rgb {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
    if (!m) return fallback;
    const h =
        m[1].length === 3
            ? m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2]
            : m[1];
    return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
    ];
}

export default function FooterTopo({ className }: { className?: string }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const reduced = useReducedMotion();

    useEffect(() => {
        const cv = ref.current;
        if (!cv) return;

        const gl = cv.getContext("webgl", {
            alpha: false,
            antialias: false,
            depth: false,
            powerPreference: "low-power",
        });
        /* No WebGL, no background. The footer's own --bg is already painted
           underneath, so the section simply reads as a flat colour. */
        if (!gl) return;

        const compile = (type: number, src: string) => {
            const s = gl.createShader(type);
            if (!s) return null;
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                gl.deleteShader(s);
                return null;
            }
            return s;
        };

        const vs = compile(gl.VERTEX_SHADER, VERT);
        const fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) {
            if (vs) gl.deleteShader(vs);
            if (fs) gl.deleteShader(fs);
            return;
        }

        const prog = gl.createProgram();
        if (!prog) return;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            gl.deleteProgram(prog);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            return;
        }
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            gl.STATIC_DRAW,
        );
        const aPos = gl.getAttribLocation(prog, "a_position");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const u = {
            res: gl.getUniformLocation(prog, "u_resolution"),
            time: gl.getUniformLocation(prog, "u_time"),
            dpr: gl.getUniformLocation(prog, "u_dpr"),
            bg: gl.getUniformLocation(prog, "u_bg"),
            line: gl.getUniformLocation(prog, "u_line"),
            grid: gl.getUniformLocation(prog, "u_grid"),
            topo: gl.getUniformLocation(prog, "u_topo"),
        };

        /* ---- theme ---- */
        let dirty = true;

        const applyTheme = () => {
            const root = document.documentElement;
            const cs = getComputedStyle(root);
            const light = root.dataset.theme === "light";

            const bg = readHex(
                cs.getPropertyValue("--bg"),
                light ? [0.937, 0.945, 0.933] : [0.004, 0.004, 0.004],
            );
            const ink = readHex(
                cs.getPropertyValue("--ink"),
                light ? [0.071, 0.086, 0.082] : [0.933, 0.945, 0.937],
            );

            gl.uniform3f(u.bg, bg[0], bg[1], bg[2]);
            gl.uniform3f(u.line, ink[0], ink[1], ink[2]);
            /* Dark ink on a light ground carries much further than white ink
               on black, so the light theme needs less of it to read the same. */
            gl.uniform1f(u.grid, light ? 0.1 : 0.13);
            gl.uniform1f(u.topo, light ? 0.28 : 0.42);
            dirty = true;
        };

        applyTheme();
        const mo = new MutationObserver(applyTheme);
        mo.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        /* ---- size ---- */
        let w = 0;
        let h = 0;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const nw = Math.max(2, Math.round(cv.clientWidth * dpr));
            const nh = Math.max(2, Math.round(cv.clientHeight * dpr));
            if (nw === w && nh === h) return;
            w = nw;
            h = nh;
            cv.width = w;
            cv.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(u.res, w, h);
            gl.uniform1f(u.dpr, dpr);
            dirty = true;
        };

        const ro = new ResizeObserver(resize);
        ro.observe(cv);
        resize();

        /* ---- frame ---- */
        let raf = 0;
        let running = false;
        const start = performance.now();

        const draw = (t: number) => {
            gl.uniform1f(u.time, reduced ? 0 : (t - start) * 0.001);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            dirty = false;
        };

        const loop = (t: number) => {
            raf = requestAnimationFrame(loop);
            draw(t);
        };

        const stop = () => {
            if (!running) return;
            cancelAnimationFrame(raf);
            running = false;
        };

        const play = () => {
            if (running) return;
            running = true;
            raf = requestAnimationFrame(loop);
        };

        /* Only while the footer is on screen. This sits at the bottom of a
           twenty-thousand-pixel page, so a permanently running loop would
           burn a GPU pass per frame for a section nobody is looking at. */
        const io = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) {
                    stop();
                    return;
                }
                /* Under reduced motion the contours must not drift, so it
                   paints one frame on arrival and stays there. */
                if (reduced) {
                    resize();
                    draw(start);
                    return;
                }
                play();
            },
            { rootMargin: "200px 0px" },
        );
        io.observe(cv);

        /* A theme flip or a resize while the footer is off screen still has to
           land, or scrolling back would show the previous theme's frame. */
        const repaintIfNeeded = () => {
            if (!running && dirty) {
                resize();
                draw(start);
            }
        };
        const themeTick = window.setInterval(repaintIfNeeded, 500);

        return () => {
            stop();
            window.clearInterval(themeTick);
            io.disconnect();
            ro.disconnect();
            mo.disconnect();
            gl.deleteBuffer(buf);
            gl.deleteProgram(prog);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            /* Deliberately not calling WEBGL_lose_context: a canvas hands back
               the same context object forever, and StrictMode's mount, cleanup,
               mount cycle would leave the second mount holding a dead one. */
        };
    }, [reduced]);

    return <canvas ref={ref} className={className} aria-hidden="true" />;
}
