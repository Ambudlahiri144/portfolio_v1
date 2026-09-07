/* ==================================================================
   INK RENDER

   Turns the site's photographic assets into the Sumi theme's two
   renders, offline, with ffmpeg:

     light  "wash and line"  indigo ink on washi paper
     dark   "bone on sumi"   bone-white duotone on blue-black

   Run:  node scripts/ink.mjs                  everything
         node scripts/ink.mjs --only hero      one source
         node scripts/ink.mjs --limit 3        first N frames per set
         node scripts/ink.mjs --frames 1,61,100 just those frame indices
         node scripts/ink.mjs --force          re-render existing outputs

   Why offline rather than a runtime shader: the prototype that was
   approved was made with exactly these ffmpeg filters, and a GLSL
   port would be an approximation of it that then needs re-tuning in
   the browser. Rendering once means the site ships what was signed
   off, at zero runtime cost, and a theme flip is a path change.
   ================================================================== */

import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";

/* ---- palette ---------------------------------------------------------
   These MUST equal --bg and --ink in globals.css for each theme. The light
   render paints its paper in --bg light and the dark render its shadows in
   --bg dark, and that identity is what keeps a frame's rectangle invisible
   against the page in both themes. Change one, change both. */
const PALETTE = {
    light: { bg: [0xf3, 0xef, 0xe6], ink: [0x14, 0x21, 0x3d] },
    dark: { bg: [0x0b, 0x0d, 0x10], ink: [0xe8, 0xe4, 0xd8] },
};

/* Maps luminance 0 → `from`, 255 → `to`, one lutrgb expression per channel. */
function duotone(from, to) {
    const ch = (i) => `'${from[i]}+${to[i] - from[i]}*val/255'`;
    return `lutrgb=r=${ch(0)}:g=${ch(1)}:b=${ch(2)}`;
}

const hex = (rgb) => "0x" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

/* Light: the wash is ink → paper. The lines are ink → WHITE, not ink → paper,
   and that is not a typo. The two layers are combined with a multiply blend,
   and paper × paper is darker than paper (243 × 243 / 255 = 231). The
   frame's empty corners then came out #e7e1cf against a #f3efe6 page, which
   is exactly the visible rectangle this whole pipeline exists to prevent.
   White is the identity under multiply, so where there is no line the wash
   passes through untouched and the corners stay the page colour. */
const WHITE = [255, 255, 255];
const WASH_L = `hue=s=0,${duotone(PALETTE.light.ink, PALETTE.light.bg)}`;
const LINES_L = `gblur=sigma=1.4,edgedetect=low=0.06:high=0.18,negate,${duotone(PALETTE.light.ink, WHITE)}`;
/* Dark: shadows → sumi, highlights → bone. Photographic, not keyed. */
const DUO_D = `hue=s=0,${duotone(PALETTE.dark.bg, PALETTE.dark.ink)}`;

/* ---- filter graphs -------------------------------------------------- */

/**
 * The light render. `key` removes a black studio background to paper, which
 * is what makes a figure lit against black read as ink on a page; for busy
 * artwork with no clean background it is left off and the whole frame becomes
 * a wash with lines over it.
 *
 * `sm` adds a second, downscaled output from the same processed frame so the
 * phone set is a resample of the finished render, not a re-render at a lower
 * resolution where the edge detector would draw proportionally thicker lines.
 */
function lightGraph({ w, h, key, sm }) {
    const paper = hex(PALETTE.light.bg);
    const parts = [];
    if (key) {
        parts.push(
            `[0]scale=${w}:${h}:flags=lanczos,split=3[a][b][c]`,
            `[a]${WASH_L}[wash]`,
            /* The key is topological, not tonal.

               A luminance threshold alone cannot work here: the deepest folds
               of the hoodie are as dark as the #010101 studio behind it, so
               any cut that removes the studio also punches paper-coloured
               holes into the figure, and no morphological kernel closes a
               hole 300px across. What does separate them is connectivity: the
               real background touches the frame border and interior folds
               never do. So: threshold at 5 to a binary mask, flood-fill the
               zero region from all four corners with a marker value, and
               treat everything the fill did not reach as figure. One opening
               pass (erode, dilate) removes single-pixel noise islands in the
               studio; the blur softens the edge by a pixel so the wash meets
               the contour line rather than stopping a hair short of it. */
            `[b]format=gray,lut='if(gt(val,5),255,0)',floodfill=x=0:y=0:s0=0:d0=128,floodfill=x=${w - 1}:y=0:s0=0:d0=128,floodfill=x=0:y=${h - 1}:s0=0:d0=128,floodfill=x=${w - 1}:y=${h - 1}:s0=0:d0=128,lut='if(eq(val,128),0,255)',erosion,dilation,gblur=sigma=1.2,format=gray[mask]`,
            `color=c=${paper}:s=${w}x${h}:d=1[paper]`,
            `[wash][mask]alphamerge[fig]`,
            `[paper][fig]overlay=format=auto[comp]`,
            `[c]${LINES_L}[lines]`,
            `[comp][lines]blend=all_mode=multiply,format=rgb24[out]`,
        );
    } else {
        parts.push(
            `[0]scale=${w}:${h}:flags=lanczos,split=2[a][c]`,
            `[a]${WASH_L}[wash]`,
            `[c]${LINES_L}[lines]`,
            `[wash][lines]blend=all_mode=multiply,format=rgb24[out]`,
        );
    }
    if (sm) {
        parts.push(`[out]split=2[lg][tmp]`, `[tmp]scale=${sm.w}:${sm.h}:flags=lanczos[smo]`);
        return { graph: parts.join(";"), maps: ["[lg]", "[smo]"] };
    }
    return { graph: parts.join(";"), maps: ["[out]"] };
}

function darkGraph({ w, h, sm }) {
    const parts = [`[0]scale=${w}:${h}:flags=lanczos,${DUO_D},format=rgb24[out]`];
    if (sm) {
        parts.push(`[out]split=2[lg][tmp]`, `[tmp]scale=${sm.w}:${sm.h}:flags=lanczos[smo]`);
        return { graph: parts.join(";"), maps: ["[lg]", "[smo]"] };
    }
    return { graph: parts.join(";"), maps: ["[out]"] };
}

/* ---- jobs ----------------------------------------------------------- */

const ROOT = path.resolve(process.cwd(), "public");
const OUT = path.join(ROOT, "ink");
const ENC = ["-c:v", "libwebp", "-quality", "82", "-compression_level", "6"];

const pad = (n) => String(n).padStart(3, "0");

/* Each source: where its frames come from, their native size, the phone size,
   whether the black background should be keyed to paper, and how many. */
const SOURCES = {
    hero: {
        src: (i) => path.join(ROOT, "hero-motion", `frame-${pad(i)}.webp`),
        count: 145,
        w: 2560, h: 1440, sm: { w: 1280, h: 720 },
        key: () => true,
        out: (theme, i, small) =>
            path.join(OUT, "hero", theme, small ? "sm" : "", `frame-${pad(i)}.webp`),
    },
    contact: {
        src: (i) => path.join(ROOT, "contact-motion", `frame-${pad(i)}.webp`),
        count: 142,
        w: 1920, h: 1080, sm: { w: 960, h: 540 },
        /* Never keyed. Neither shot in this footage sits on a black studio:
           the portafilter is in a lit scene and the cup's background is a grey
           rack (corners measure around #38372d). Keying by darkness would only
           punch paper into the scene's own shadows. It renders as a full-frame
           wash instead, and the section's edge veil, which exists because
           these frames were never black-edged, dissolves the borders into the
           page in both themes. */
        key: () => false,
        out: (theme, i, small) =>
            path.join(OUT, "contact", theme, small ? "sm" : "", `frame-${pad(i)}.webp`),
    },
};

/* Single images: keyed off, native size (read by ffprobe at run time). */
const IMAGES = [
    { id: "murmur", src: path.join(ROOT, "projects", "murmur.webp"), out: (t) => path.join(OUT, "projects", t, "murmur.webp") },
    { id: "bail", src: path.join(ROOT, "projects", "bail.webp"), out: (t) => path.join(OUT, "projects", t, "bail.webp") },
    { id: "bu", src: path.join(ROOT, "projects", "bu.webp"), out: (t) => path.join(OUT, "projects", t, "bu.webp") },
    { id: "kine", src: path.join(ROOT, "projects", "kine.webp"), out: (t) => path.join(OUT, "projects", t, "kine.webp") },
    /* The two portraits are different photographs; each renders for its own
       theme only. */
    { id: "portrait-light", src: path.join(ROOT, "light.png"), themes: ["light"], out: () => path.join(OUT, "portrait-light.webp") },
    { id: "portrait-dark", src: path.join(ROOT, "dark.png"), themes: ["dark"], out: () => path.join(OUT, "portrait-dark.webp") },
];

/* ---- process plumbing ---------------------------------------------- */

function run(cmd, args) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
        let err = "";
        let out = "";
        p.stdout.on("data", (d) => (out += d));
        p.stderr.on("data", (d) => (err += d));
        p.on("close", (code) =>
            code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}\n${err}`)),
        );
    });
}

async function probe(file) {
    const out = await run("ffprobe", [
        "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "csv=p=0", file,
    ]);
    const [w, h] = out.trim().split(",").map(Number);
    return { w, h };
}

async function ensureDir(file) {
    await mkdir(path.dirname(file), { recursive: true });
}

async function render({ src, theme, key, w, h, sm, outs }) {
    const { graph, maps } = theme === "light" ? lightGraph({ w, h, key, sm }) : darkGraph({ w, h, sm });
    const args = ["-v", "error", "-y", "-i", src, "-filter_complex", graph];
    maps.forEach((m, i) => {
        args.push("-map", m, "-frames:v", "1", ...ENC, outs[i]);
    });
    await Promise.all(outs.map(ensureDir));
    await run("ffmpeg", args);
}

/* A small pool. ffmpeg is single-threaded per filter graph at this size, so
   running several at once is what actually uses the machine. */
async function pool(tasks, size) {
    let next = 0;
    let done = 0;
    const total = tasks.length;
    const started = Date.now();
    const worker = async () => {
        while (next < total) {
            const task = tasks[next++];
            await task();
            done++;
            if (done % 25 === 0 || done === total) {
                const s = ((Date.now() - started) / 1000).toFixed(0);
                process.stdout.write(`  ${done}/${total}  (${s}s)\n`);
            }
        }
    };
    await Promise.all(Array.from({ length: size }, worker));
}

/* ---- main ----------------------------------------------------------- */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
};

const only = opt("only");
const limit = opt("limit") ? Number(opt("limit")) : Infinity;
/* --frames 1,61,100 renders just those indices of each sequence. */
const frames = opt("frames") ? new Set(opt("frames").split(",").map(Number)) : null;
const force = flag("force");
const THEMES = ["light", "dark"];

const tasks = [];

for (const [id, s] of Object.entries(SOURCES)) {
    if (only && only !== id) continue;
    if (!existsSync(s.src(1))) {
        console.error(`skip ${id}: ${s.src(1)} not found`);
        continue;
    }
    const n = Math.min(s.count, limit);
    for (let i = 1; i <= n; i++) {
        if (frames && !frames.has(i)) continue;
        for (const theme of THEMES) {
            const outs = [s.out(theme, i, false), s.out(theme, i, true)];
            if (!force && outs.every((f) => existsSync(f))) continue;
            tasks.push(() => render({ src: s.src(i), theme, key: s.key(i), w: s.w, h: s.h, sm: s.sm, outs }));
        }
    }
}

if (!only || only === "images") {
    for (const img of IMAGES) {
        if (!existsSync(img.src)) {
            console.error(`skip ${img.id}: ${img.src} not found`);
            continue;
        }
        for (const theme of img.themes ?? THEMES) {
            const out = img.out(theme);
            if (!force && existsSync(out)) continue;
            tasks.push(async () => {
                const { w, h } = await probe(img.src);
                await render({ src: img.src, theme, key: false, w, h, sm: null, outs: [out] });
            });
        }
    }
}

if (tasks.length === 0) {
    console.log("Nothing to render (all outputs exist; use --force to redo).");
    process.exit(0);
}

const workers = Math.max(2, Math.min(6, cpus().length - 1));
console.log(`Rendering ${tasks.length} jobs on ${workers} workers → ${OUT}`);
await pool(tasks, workers);

/* Summarise. */
async function sizeOf(dir) {
    let total = 0;
    const { readdir } = await import("node:fs/promises");
    const walk = async (d) => {
        for (const e of await readdir(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) await walk(p);
            else total += (await stat(p)).size;
        }
    };
    if (existsSync(dir)) await walk(dir);
    return total;
}
for (const id of Object.keys(SOURCES)) {
    for (const theme of THEMES) {
        const d = path.join(OUT, id, theme);
        const mb = (await sizeOf(d)) / 1024 / 1024;
        if (mb > 0) console.log(`  ${id}/${theme}: ${mb.toFixed(1)} MB (incl. sm)`);
    }
}
console.log("Done.");
