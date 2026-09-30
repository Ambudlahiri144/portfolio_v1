#!/usr/bin/env node
/* ==================================================================
   BOOK FRAMES — renders the light theme's book footage into the WebP
   frame sets the site scrubs, plus the manifest that describes them.

     node scripts/book-frames.mjs            # everything
     node scripts/book-frames.mjs --only turnA

   In:  assets-src/book/source/   the supplied Veo clips (V1 open, V2 turns)
   Out: assets-src/book/masters/  lossless PNG frames (not deployed)
        public/book/<clip>/<tier>/0001.webp
        public/book/manifest.json

   Everything specific to the footage is in CONFIG below. Re-generating
   the clips (say at 1080p, or a cleaner page turn) means updating the
   frame ranges and page rectangles there and re-running — nothing in
   src/ hardcodes a frame count.

   Why the steps are what they are:
   - Watermark: Veo stamps a sparkle in the lower right. delogo leaves a
     smooth smear that reads as a stain on linen, so a clean patch of the
     same cloth from just above it is laid over instead.
   - Holds: every page on the site rests on ONE canonical frame. Each
     clip crossfades into it at the end (and turns out of it at the
     start), so a hold after the cover opens and a hold after the fifth
     page turn are the identical image and the HTML pages sit on exactly
     the same rectangles.
   - The open clip is cut before V1's frame 152, where Veo snaps to its
     last-frame target in one jump.
   ================================================================== */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readdirSync, writeFileSync, existsSync, readFileSync, renameSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "assets-src/book/source");
const MASTERS = join(ROOT, "assets-src/book/masters");
const OUT = join(ROOT, "public/book");

const CONFIG = {
    fps: 24,
    /* Source frame size. The rectangles below are in these pixels. */
    width: 1280,
    height: 720,

    /* The frames holds rest on. Every clip that ends at a camera position
       fades into that position's rest, so all holds there are the identical
       image and the HTML (or 3D) on them lands on the same pixels.
         overhead  the book open flat, seen from directly above
         front     the same spread from low in front, for the pop-ups */
    rests: {
        overhead: { file: "V2.mp4", frame: 5 },
        front: { file: "V3.mp4", frame: 175 },
        /* The closed book from overhead (the open clip's first frame): where
           the cat's reveal starts. */
        closed: { file: "V1.mp4", frame: 16 },
        /* The cat's last scene: the first frame of her waiting loop, which
           every one of her end clips starts and ends on, so the video
           patched over her always matches the frame around it. */
        end: { file: "../cat/cat-idle.mp4", frame: 0, watermark: { mode: "interpolate" } },
    },

    /* Frame numbers are 0-based, inclusive, in the SOURCE file. fadeIn and
       fadeOut blend from/into the named rest (`from`/`to`).

       `snaps` lists source frames s where Veo jumps between s and s + 1 (a
       single step worth ~3 frames of motion). Two motion-compensated
       in-betweens are synthesised and inserted there, so the jump becomes
       motion. A crossfade was tried first and is worse: during a camera
       move it dissolves between two camera positions and shows a ghost of
       the page edge. */
    clips: {
        open: { file: "V1.mp4", start: 16, end: 150, fadeIn: 0, fadeOut: 14, to: "overhead" },
        turnA: { file: "V2.mp4", start: 20, end: 94, fadeIn: 4, fadeOut: 8, from: "overhead", to: "overhead" },
        turnB: { file: "V2.mp4", start: 97, end: 147, fadeIn: 4, fadeOut: 8, from: "overhead", to: "overhead" },
        tilt: {
            file: "V3.mp4", start: 12, end: 168, fadeIn: 6, fadeOut: 10,
            from: "overhead", to: "front",
            snaps: [62],
            /* As the camera comes down the book's edge passes through the
               sparkle's corner of the frame, so no fixed patch of cloth
               matches every frame. This clip rebuilds the region from its
               border on each frame instead, with grain laid back over it. */
            watermark: { mode: "interpolate" },
        },
        /* After the book closes, the camera comes down to the low side angle
           where the cat lies on the table (V4, generated from the closed
           rest to K-end). -1 is "the source's last frame". */
        /* Until V4.mp4 has been generated, a slow dissolve with a push-in
           stands in (standInReveal below), and is replaced as soon as it is. */
        reveal: {
            file: "V4.mp4", start: 0, end: -1, fadeIn: 4, fadeOut: 8,
            from: "closed", to: "end",
            watermark: { mode: "interpolate" },
            standIn: true,
        },
    },

    /* Sparkle watermark: cover [x,y,w,h] with the patch of cloth at [sx,sy]. */
    watermark: { x: 1126, y: 568, w: 64, h: 60, sx: 1128, sy: 508 },

    /* Light spatial clean-up. Veo output at 720p shimmers faintly; this is
       enough to calm it without smearing the paper grain. */
    clean: "hqdn3d=1.2:1.2:4:4,unsharp=5:5:0.35",

    /* Widths of the delivered sets. lg is the source width — there is no
       detail above it to deliver. */
    tiers: { lg: 1280, md: 960, sm: 640 },
    webpQuality: 50,

    /* Geometry, in source pixels, measured on the hold frame and the first
       frame of the open clip. The site maps these through the same fit
       maths the canvas uses, so HTML lands on the paper. */
    geometry: {
        /* Everything that must stay on screen when the canvas is fitted:
           the whole open book including the ribbon tail. */
        book: [200, 66, 885, 628],
        pages: {
            left: [246, 74, 392, 510],
            right: [652, 74, 390, 512],
        },
        /* The ribbon crosses the right page's lower left; content on that
           page keeps clear of this box. */
        ribbon: [644, 412, 180, 176],
        /* The closed book on the cover, and its debossed title panel. */
        coverBook: [655, 66, 414, 546],
        coverLabel: [805, 243, 161, 69],

        /* The front rest. `pageQuad` is the flat top of the page block,
           far-left, far-right, near-right, near-left: what
           scripts/calibrate-camera.mjs solves the 3D camera from. The
           spread's real size comes from the overhead rest, where its
           796 x 510 px pages measure 1.56:1 — a 24.6 x 32 cm page. */
        front: {
            pageQuad: [[215, 217], [1042, 213], [1145, 438], [138, 442]],
            spreadCm: [49.2, 32],
        },

        /* The cat's last scene (the end rest), measured on it.
           bookQuad  the closed book's top face: back-left (the spine's
                     head), back-right, front-right, front-left, for
                     calibrate-camera.mjs --rest end; it is the book's
                     width (25.6 cm) across and its height (33.7 cm, the
                     spine) in depth, as measured on the cover overhead
           tableY    the table, that far below the face: the book's
                     thickness
           text      the free wall at the upper left, for the colophon
           blocks    the strip of table in front of her for the type */
        end: {
            bookQuad: [[108, 383], [417, 362], [542, 465], [197, 499]],
            bookCm: [25.6, 33.7],
            tableY: -3,
            text: [150, 70, 400, 240],
            blocks: [420, 556, 760, 84],
        },
    },
};

/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

function ffmpeg(argv) {
    execFileSync("ffmpeg", ["-v", "error", "-y", ...argv], { stdio: "inherit" });
}

function watermarkChain(input, output, override = {}) {
    const { x, y, w, h, sx, sy, mode } = { ...CONFIG.watermark, ...override };
    if (mode === "none") return `[${input}]null[${output}]`;
    if (mode === "interpolate") {
        return (
            `[${input}]delogo=x=${x + 4}:y=${y + 4}:w=${w - 8}:h=${h - 8},split[wa][wb];` +
            `[wb]crop=${w - 8}:${h - 8}:${x + 4}:${y + 4},noise=alls=10:allf=t+u[wp];` +
            `[wa][wp]overlay=${x + 4}:${y + 4}[${output}]`
        );
    }
    return `[${input}]split[wa][wb];[wb]crop=${w}:${h}:${sx}:${sy}[wp];[wa][wp]overlay=${x}:${y}[${output}]`;
}

/* Frames in a source video (for the "-1 is the last frame" convention). */
function frameCount(file) {
    const out = execFileSync("ffprobe", [
        "-v", "error", "-select_streams", "v:0", "-count_packets",
        "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", resolve(SRC, file),
    ]).toString().trim();
    return Number(out);
}
const last = (file, n) => (n < 0 ? frameCount(file) + n : n);
/* Footage that has not been generated yet (the cat's V4) is simply
   skipped, rest and clip alike, until it is there. */
const have = (file) => existsSync(resolve(SRC, file));

/* The cat's reveal before V4.mp4 exists: the closed book, a slow push-in
   toward it, dissolving into her last scene as that settles out of a
   slight zoom. Made from the two rest frames, so it lands exactly. */
function standInReveal(rests) {
    const out = join(MASTERS, "reveal-standin.mp4");
    const { fps, width: W, height: H } = CONFIG;
    ffmpeg([
        "-loop", "1", "-framerate", String(fps), "-t", "4", "-i", rests.closed,
        "-loop", "1", "-framerate", String(fps), "-t", "3", "-i", rests.end,
        "-filter_complex",
        `[0:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.14*on/96':x='min(iw-iw/zoom,max(0,1720-iw/zoom/2))':y='max(0,680-ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps},format=yuv420p[a];` +
            `[1:v]scale=${W * 2}:${H * 2},zoompan=z='1.07-0.07*on/71':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${W}x${H}:fps=${fps},format=yuv420p[b];` +
            `[a][b]xfade=transition=fade:duration=2:offset=2,format=yuv420p[o]`,
        "-map", "[o]", "-c:v", "libx264", "-crf", "12", "-preset", "medium", out,
    ]);
    return out;
}

function count(dir) {
    return readdirSync(dir).filter((f) => /\.(png|webp)$/.test(f)).length;
}

function renderRest(name) {
    const { file, watermark } = CONFIG.rests[name];
    const frame = last(file, CONFIG.rests[name].frame);
    mkdirSync(MASTERS, { recursive: true });
    const out = join(MASTERS, `rest-${name}.png`);
    ffmpeg([
        "-i", resolve(SRC, file),
        "-filter_complex",
        `[0:v]select=eq(n\\,${frame}),setpts=N/FRAME_RATE/TB,scale=${CONFIG.width}:${CONFIG.height}[s];${watermarkChain("s", "w", watermark)};[w]${CONFIG.clean},format=rgb24[o]`,
        "-map", "[o]", "-frames:v", "1", out,
    ]);
    return out;
}

function renderClip(name, spec, rests) {
    const dir = join(MASTERS, name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    const { fps } = CONFIG;
    spec = { ...spec, end: last(spec.file, spec.end) };
    const len = spec.end - spec.start + 1;
    const g = [];

    g.push(
        `[0:v]trim=start_frame=${spec.start}:end_frame=${spec.end + 1},setpts=PTS-STARTPTS,fps=${fps}[t]`,
        watermarkChain("t", "w", spec.watermark),
        `[w]${CONFIG.clean},deflicker=mode=pm:size=5,format=yuv444p,settb=AVTB[c]`,
    );

    let cur = "c";
    /* xfade's output length is offset + length of its second input, so the
       hold stream after the fade-out is fadeOut + 1 frames: the blend, then
       one frame of pure hold to end on. */
    if (spec.fadeIn > 0) {
        g.push(`[1:v]trim=end_frame=${spec.fadeIn},setpts=PTS-STARTPTS,format=yuv444p,settb=AVTB[h0]`);
        g.push(`[h0][${cur}]xfade=transition=fade:duration=${spec.fadeIn / fps}:offset=0[ci]`);
        cur = "ci";
    }
    if (spec.fadeOut > 0) {
        const offset = (len - spec.fadeOut) / fps;
        g.push(`[2:v]trim=end_frame=${spec.fadeOut + 1},setpts=PTS-STARTPTS,format=yuv444p,settb=AVTB[h1]`);
        g.push(`[${cur}][h1]xfade=transition=fade:duration=${spec.fadeOut / fps}:offset=${offset}[co]`);
        cur = "co";
    }
    g.push(`[${cur}]format=rgb24[o]`);

    /* Inputs 1 and 2 are the rests faded from and to. A clip without one
       still gets a (never used) input, which keeps the stream indices put. */
    const fromPng = rests[spec.from ?? spec.to];
    const toPng = rests[spec.to ?? spec.from];
    ffmpeg([
        "-i", resolve(SRC, spec.file),
        "-loop", "1", "-framerate", String(fps), "-i", fromPng,
        "-loop", "1", "-framerate", String(fps), "-i", toPng,
        "-filter_complex", g.join(";"),
        "-map", "[o]", "-fps_mode", "passthrough",
        join(dir, "%04d.png"),
    ]);

    /* Latest first, so inserting frames never shifts a snap still to do. */
    for (const s of [...(spec.snaps ?? [])].sort((a, b) => b - a)) absorbSnap(dir, s - spec.start);
    return count(dir);
}

/* The clip jumps between local frames i and i + 1 (0-based). Synthesise two
   motion-compensated in-betweens with minterpolate and insert them.

   minterpolate needs motion either side to estimate from, so it is given
   frames i-1 .. i+2 at 1 fps and asked for 3 fps: outputs 4 and 7 are
   frames i and i+1 again, and outputs 5 and 6 are the in-betweens at a
   third and two thirds of the way. */
function absorbSnap(dir, i) {
    const file = (n) => join(dir, `${String(n + 1).padStart(4, "0")}.png`);
    const work = join(dir, "_snap");
    rmSync(work, { recursive: true, force: true });
    mkdirSync(join(work, "in"), { recursive: true });
    mkdirSync(join(work, "out"), { recursive: true });
    [i - 1, i, i + 1, i + 2].forEach((n, k) =>
        copyFileSync(file(n), join(work, "in", `${String(k + 1).padStart(4, "0")}.png`)),
    );
    ffmpeg([
        "-framerate", "1", "-i", join(work, "in", "%04d.png"),
        "-vf", "minterpolate=fps=3:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=rgb24",
        "-fps_mode", "passthrough", join(work, "out", "%04d.png"),
    ]);
    /* Make room: shift every frame after i up by two, last first. */
    const total = count(dir);
    for (let n = total - 1; n > i; n--) renameSync(file(n), file(n + 2));
    renameSync(join(work, "out", "0005.png"), file(i + 1));
    renameSync(join(work, "out", "0006.png"), file(i + 2));
    rmSync(work, { recursive: true, force: true });
}

function encode(name) {
    for (const [tier, width] of Object.entries(CONFIG.tiers)) {
        const dir = join(OUT, name, tier);
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
        ffmpeg([
            "-i", join(MASTERS, name, "%04d.png"),
            "-vf", `scale=${width}:-2:flags=lanczos`,
            "-c:v", "libwebp", "-quality", String(CONFIG.webpQuality),
            "-compression_level", "6", "-preset", "photo",
            join(dir, "%04d.webp"),
        ]);
    }
}

/* Mean colour of a strip of bare tablecloth on the hold frame. The page
   background has to be this, or the canvas edge shows. */
function sampleTable(holdPng) {
    const buf = execFileSync("ffmpeg", [
        "-v", "error", "-i", holdPng,
        "-vf", "crop=48:ih:0:0,scale=1:1:flags=area",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ]);
    return "#" + [...buf.subarray(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ */

if (!existsSync(SRC)) {
    console.error(`Missing ${SRC}. Put V1.mp4 and V2.mp4 there first.`);
    process.exit(1);
}

const rests = Object.fromEntries(
    Object.keys(CONFIG.rests)
        .filter((r) => have(CONFIG.rests[r].file))
        .map((r) => [r, renderRest(r)]),
);
const clips = {};

for (let [name, spec] of Object.entries(CONFIG.clips)) {
    if (spec.standIn && !have(spec.file) && rests.closed && rests.end) {
        console.log(`${name}: no ${spec.file} yet, a dissolve stands in`);
        spec = { ...spec, file: standInReveal(rests), watermark: { mode: "none" } };
    }
    if (!have(spec.file)) {
        console.log(`${name}: no ${spec.file} yet, skipped`);
        continue;
    }
    if (only && only !== name) {
        const dir = join(OUT, name, "lg");
        if (existsSync(dir)) clips[name] = { count: count(dir) };
        continue;
    }
    const n = renderClip(name, spec, rests);
    encode(name);
    clips[name] = { count: n };
    console.log(`${name}: ${n} frames`);
}

/* The 3D cameras (the front rest's, and the cat's end), solved by
   scripts/calibrate-camera.mjs.
   Carried over from the existing manifest so re-rendering frames never
   throws away a hand-tuned calibration. */
const previous = existsSync(join(OUT, "manifest.json"))
    ? JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8"))
    : {};

const manifest = {
    /* Bump when frames change so browsers never mix old and new. */
    version: Date.now().toString(36),
    width: CONFIG.width,
    height: CONFIG.height,
    table: sampleTable(rests.overhead),
    tiers: CONFIG.tiers,
    clips,
    /* geometry.end is measured once the cat's last scene exists; until it
       is in CONFIG, whatever an earlier run had is kept. */
    geometry: { ...(previous.geometry?.end ? { end: previous.geometry.end } : {}), ...CONFIG.geometry },
    ...(previous.camera ? { camera: previous.camera } : {}),
    ...(previous.cameras ? { cameras: previous.cameras } : {}),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: table ${manifest.table}`, clips);
