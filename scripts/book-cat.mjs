#!/usr/bin/env node
/* ==================================================================
   BOOK CAT — the Siamese cat's footage, made ready for the light theme.

     node scripts/book-cat.mjs              from the generated footage
     node scripts/book-cat.mjs --stand-in   synthetic stand-ins, to try
                                            the whole scene before the
                                            footage exists

   In:  assets-src/book/cat/          the generated clips (PROMPTS.md there
                                      says what each one is)
        assets-src/book/masters/      rest-overhead.png, rest-end.png (the
                                      last scene's still, made by
                                      book-frames.mjs from V4)
   Out: public/book/cat/              walk.webp, peek.webp, end/*.mp4|webm,
                                      end-still.webp, cat.json

   The walk-by and the peek happen over the open book, and are cut out
   against the clip's own first frame (the empty scene, since each starts
   and ends on the rest): every pixel that differs from it is her (or her
   shadow, which differs a little, so it comes through half transparent,
   as a shadow should). The clip's own frame rather than the book's rest,
   because the video tool shifts the ribbon a pixel or two and stamps its
   sparkle: both are in every frame, so both cancel. They ship
   as play-once animated WebPs with alpha, which every current browser
   plays; VP9 video's alpha does not work in Safari.

   The end clips never need alpha: nothing but the table is behind her,
   so each is cropped to one box around her (the union of where any clip
   moves), and plays over the still as an opaque patch whose edges the
   CSS feathers.

   Where her parts are (for petting), and when she brushes the pen or
   the ribbon, are hand-set below in CONFIG, measured on the footage.
   ================================================================== */

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "assets-src/book/cat");
const MASTERS = join(ROOT, "assets-src/book/masters");
const OUT = join(ROOT, "public/book/cat");
const MANIFEST = join(ROOT, "public/book/manifest.json");

const CONFIG = {
    fps: 18,
    /* The overlays are encoded smaller than the frame and scaled back up
       on screen: they are big (the cat crosses the whole right page), and
       at this scale the difference does not show. */
    overlayScale: 0.72,
    overlayQuality: 60,
    /* Difference from the rest (0-255) that is certainly not her, and
       certainly her; in between is soft (fur edges, shadow). */
    matte: { low: 18, high: 46, blur: 1.6 },
    /* A watermark the video tool stamps, if any: { x, y, w, h } in the
       1280 x 720 frame, rebuilt from its surroundings. null if none. */
    watermark: { x: 1126, y: 568, w: 64, h: 60 },
    /* The same light clean-up the book's frames get (book-frames.mjs), so
       the end clips match the still they are patched into. */
    clean: "hqdn3d=1.2:1.2:4:4,unsharp=5:5:0.35",

    walk: {
        file: "cat-walk.mp4",
        /* Seconds into the clip when she passes the resting pen and the
           ribbon. Set by watching the clip; the stand-in's are guesses. */
        cues: [
            { t: 0.7, event: "gust", cord: "ribbon", strength: 1.1 },
            { t: 1.9, event: "penNudge", dx: -0.6, rot: 9 },
        ],
    },
    peek: {
        file: "cat-peek.mp4",
        cues: [{ t: 1.1, event: "gust", cord: "ribbon", strength: 0.7 }],
    },

    end: {
        idle: ["idle", "idle-look"],
        clips: {
            idle: "cat-idle.mp4",
            "idle-look": "cat-idle-look.mp4",
            "pet-head": "react-pet-head.mp4",
            chin: "react-chin.mp4",
            ear: "react-ear.mp4",
            back: "react-back.mp4",
            tail: "react-tail.mp4",
            paws: "react-paws.mp4",
            scratch: "react-scratch.mp4",
            yawn: "react-yawn.mp4",
            watch: "react-watch.mp4",
        },
        /* Her parts, as polygons in the still's source px (1280 x 720),
           traced on the end rest. Drawn in this order, so the smaller parts
           listed later win where they overlap the body. */
        regions: {
            back: [[800, 250], [900, 226], [1050, 240], [1150, 290], [1200, 360], [1182, 396], [1080, 440], [900, 452], [822, 420]],
            tail: [[760, 470], [900, 455], [1080, 440], [1182, 396], [1220, 420], [1200, 482], [1100, 510], [900, 522], [760, 515]],
            neck: [[604, 330], [800, 322], [812, 440], [620, 450]],
            paws: [[615, 440], [830, 420], [900, 470], [862, 505], [700, 506], [624, 486]],
            chin: [[622, 286], [700, 300], [776, 286], [746, 330], [700, 342], [655, 330]],
            face: [[602, 205], [792, 200], [776, 286], [700, 300], [622, 286]],
            head: [[615, 150], [760, 144], [792, 200], [602, 205]],
            ear: [[572, 92], [640, 150], [615, 205], [585, 200], [576, 150]],
        },
    },
};

const standIn = process.argv.includes("--stand-in");

const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { maxBuffer: 256 << 20, ...opts });
const ffmpeg = (argv) => run("ffmpeg", ["-v", "error", "-y", ...argv], { stdio: "inherit" });
const duration = (file) =>
    Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/* The watermark, rebuilt from its border, as book-frames does for tilt. */
const unmark = () => {
    const w = CONFIG.watermark;
    return w ? `delogo=x=${w.x}:y=${w.y}:w=${w.w}:h=${w.h},` : "";
};

/* The union, over the whole clip, of where it differs from the rest: one
   box, in source px. cropdetect with reset=0 reports it on its last line. */
/* The clean plate: the clip's own first frame, before anything moves. */
const plate = (input) => `[${input}:v]select=eq(n\\,0),${unmark()}scale=1280:720,format=gbrp,loop=loop=-1:size=1:start=0[r]`;

function movingBox(clip, margin) {
    const res = spawnSync("ffmpeg", [
        "-v", "info", "-i", clip, "-i", clip,
        "-filter_complex",
        `[0:v]${unmark()}scale=1280:720,format=gbrp[v];${plate(1)};` +
            `[v][r]blend=all_mode=difference:shortest=1,format=gray,lut=y='if(gt(val,${CONFIG.matte.high}),255,0)',cropdetect=limit=0.1:round=2:reset=0`,
        "-f", "null", "-",
    ], { maxBuffer: 256 << 20 });
    const log = res.stderr.toString();
    const found = [...log.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop();
    if (!found) throw new Error(`Nothing moves in ${clip}?`);
    const [w, h, x, y] = found.slice(1).map(Number);
    const x0 = Math.max(0, x - margin);
    const y0 = Math.max(0, y - margin);
    return [x0, y0, even(Math.min(1280 - x0, w + margin * 2)), even(Math.min(720 - y0, h + margin * 2))];
}

/* One of the overhead clips, cut out against the rest, as an animated
   WebP with alpha that plays once. */
function overlay(name, spec) {
    const clip = join(SRC, spec.file);
    const box = movingBox(clip, 16);
    const [bx, by, bw, bh] = box;
    const { low, high, blur } = CONFIG.matte;
    ffmpeg([
        "-i", clip, "-i", clip,
        "-filter_complex",
        `[0:v]${unmark()}scale=1280:720,fps=${CONFIG.fps},format=gbrp,split[v][vm];${plate(1)};` +
            `[vm][r]blend=all_mode=difference:shortest=1,format=gray,split[d1][d2];` +
            /* Soft: fur edges and her shadow, in proportion to how much
               they differ. */
            `[d1]lut=y='clip((val-${low})*255/${high - low},0,255)',gblur=sigma=${blur}[soft];` +
            /* Solid: where cream fur passes over beige cloth the difference
               is small, and she would turn see-through. A closing (grow,
               then shrink a little more) fills her in to her silhouette. */
            `[d2]lut=y='if(gt(val,${high}),255,0)',${"dilation,".repeat(6)}${"erosion,".repeat(8)}gblur=sigma=1.4[solid];` +
            `[soft][solid]blend=all_mode=lighten[m];` +
            `[v][m]alphamerge,crop=${bw}:${bh}:${bx}:${by},scale=${even(bw * CONFIG.overlayScale)}:${even(bh * CONFIG.overlayScale)}:flags=lanczos,format=yuva420p[o]`,
        "-map", "[o]", "-c:v", "libwebp_anim", "-loop", "1", "-quality", String(CONFIG.overlayQuality), "-lossless", "0",
        join(OUT, `${name}.webp`),
    ]);
    return { src: `/book/cat/${name}.webp`, box, duration: +duration(clip).toFixed(2), cues: spec.cues };
}

/* The end clips: one shared box around her, each cropped to it. */
function endClips(rest) {
    const present = Object.entries(CONFIG.end.clips).filter(([, f]) => existsSync(join(SRC, f)));
    if (present.length === 0) return null;
    /* A wide margin: the patch's edge is feathered, and inside the feather
       the still shows through, so nothing that moves may reach it. */
    const boxes = present.map(([, f]) => movingBox(join(SRC, f), 56));
    const x0 = Math.min(...boxes.map((b) => b[0]));
    const y0 = Math.min(...boxes.map((b) => b[1]));
    const x1 = Math.max(...boxes.map((b) => b[0] + b[2]));
    const y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
    const box = [x0, y0, even(x1 - x0), even(y1 - y0)];
    mkdirSync(join(OUT, "end"), { recursive: true });
    const clips = {};
    for (const [name, file] of present) {
        const clip = join(SRC, file);
        const vf = `${unmark()}scale=1280:720,${CONFIG.clean},crop=${box[2]}:${box[3]}:${box[0]}:${box[1]},fps=24`;
        ffmpeg(["-i", clip, "-vf", vf, "-an", "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(OUT, "end", `${name}.mp4`)]);
        ffmpeg(["-i", clip, "-vf", vf, "-an", "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1", join(OUT, "end", `${name}.webm`)]);
        clips[name] = { mp4: `/book/cat/end/${name}.mp4`, webm: `/book/cat/end/${name}.webm`, duration: +duration(clip).toFixed(2) };
    }
    ffmpeg(["-i", rest, "-vf", "scale=1280:-2", "-c:v", "libwebp", "-quality", "82", join(OUT, "end-still.webp")]);
    return { box, still: "/book/cat/end-still.webp", idle: CONFIG.end.idle.filter((n) => clips[n]), clips, regions: CONFIG.end.regions };
}

/* ------------------------------------------------------------------
   Stand-ins: grey shapes where she will be, the right sizes, the right
   places and lengths, so every part of the scene can be tried now.
   ------------------------------------------------------------------ */

function standIns() {
    const FONT = "C\\:/Windows/Fonts/arial.ttf";
    /* A soft grey oval gliding where she will walk, and one rising where
       she will peek. */
    const oval = (name, [bw, bh], secs, cx, cy, rx, ry) =>
        ffmpeg([
            "-f", "lavfi", "-i", `color=c=0x6e6258@1:s=${bw}x${bh}:r=${CONFIG.fps}:d=${secs},format=rgba`,
            "-vf", `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(pow((X-(${cx}))/${rx},2)+pow((Y-(${cy}))/${ry},2),1),200,0)'`,
            "-c:v", "libwebp_anim", "-loop", "1", "-quality", "60", join(OUT, `${name}.webp`),
        ]);
    const walkBox = [1100, 0, 180, 720];
    oval("walk", [180, 720], 5, "90", "-120+T*190", 60, 110);
    const peekBox = [1020, 0, 260, 250];
    oval("peek", [260, 250], 5, "150", "-80+170*sin(PI*T/5)", 80, 70);

    /* The end: labelled boxes on the closed book's tablecloth. */
    const catBox = [420, 330, 220, 170];
    mkdirSync(join(OUT, "end"), { recursive: true });
    const clips = {};
    for (const name of Object.keys(CONFIG.end.clips)) {
        const secs = name.startsWith("idle") ? 6 : 3.5;
        const colour = name.startsWith("idle") ? "0xcbb79b" : "0xe0b77a";
        const file = join(OUT, "end", `${name}.mp4`);
        ffmpeg([
            "-f", "lavfi", "-i", `color=c=${colour}:s=${catBox[2]}x${catBox[3]}:r=24:d=${secs}`,
            "-vf", `drawtext=fontfile='${FONT}':text='${name}':x=(w-tw)/2:y=(h-th)/2+10*sin(2*PI*t):fontsize=26:fontcolor=0x3a2618`,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file,
        ]);
        clips[name] = { mp4: `/book/cat/end/${name}.mp4`, duration: secs };
    }
    const closed = join(MASTERS, "rest-closed.png");
    ffmpeg(["-i", closed, "-vf", "scale=1280:-2", "-c:v", "libwebp", "-quality", "80", join(OUT, "end-still.webp")]);
    const [x, y, w, h] = catBox;
    const q = (a, b, c, d) => [[x + a * w, y + b * h], [x + c * w, y + b * h], [x + c * w, y + d * h], [x + a * w, y + d * h]];
    const regions = {
        head: q(0.62, 0.0, 0.86, 0.22),
        ear: q(0.86, 0.0, 1.0, 0.22),
        face: q(0.62, 0.22, 0.86, 0.42),
        chin: q(0.86, 0.22, 1.0, 0.42),
        neck: q(0.62, 0.42, 1.0, 0.6),
        back: q(0.0, 0.0, 0.62, 0.6),
        paws: q(0.55, 0.6, 1.0, 1.0),
        tail: q(0.0, 0.6, 0.55, 1.0),
    };

    /* The last scene needs its clip, its geometry and its camera in the
       manifest. The stand-in "reveal" is the closed book held still. */
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
    for (const tier of Object.keys(manifest.tiers)) {
        const dir = join(ROOT, "public/book/reveal", tier);
        mkdirSync(dir, { recursive: true });
        for (const n of ["0001", "0002"]) copyFileSync(join(ROOT, "public/book/open", tier, "0001.webp"), join(dir, `${n}.webp`));
    }
    manifest.clips.reveal = { count: 2 };
    manifest.geometry.end = { text: [80, 90, 460, 230], blocks: [110, 520, 520, 90], tableY: -3.2, bookCm: [25.6, 33.7] };
    manifest.cameras = { ...(manifest.cameras ?? {}), end: standInCamera() };
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

    return {
        walk: { src: "/book/cat/walk.webp", box: walkBox, duration: 5, cues: CONFIG.walk.cues },
        peek: { src: "/book/cat/peek.webp", box: peekBox, duration: 5, cues: CONFIG.peek.cues },
        end: { box: catBox, still: "/book/cat/end-still.webp", idle: CONFIG.end.idle, clips, regions },
    };
}

/* A camera for the stand-in: looking down at the table from the front at
   50 degrees, so the blocks' faces show. The real one is solved from
   K-end by calibrate-camera.mjs --rest end. */
function standInCamera() {
    const pitch = (-50 * Math.PI) / 180;
    return {
        fov: 30,
        position: [0, 62, 52],
        quaternion: [Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)],
        pitch: 0,
        near: 1,
        far: 1000,
        unit: "cm",
    };
}

/* ------------------------------------------------------------------ */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let data;
if (standIn) {
    data = standIns();
} else {
    const end = join(MASTERS, "rest-end.png");
    data = {};
    for (const kind of ["walk", "peek"]) {
        if (existsSync(join(SRC, CONFIG[kind].file))) data[kind] = overlay(kind, CONFIG[kind]);
        else console.log(`${kind}: no ${CONFIG[kind].file} yet, skipped`);
    }
    if (existsSync(end)) {
        const e = endClips(end);
        if (e) data.end = e;
        else console.log("end: no clips yet, skipped");
    } else {
        console.log("end: no rest-end.png yet (run book-frames.mjs once V4.mp4 is in), skipped");
    }
}

writeFileSync(join(OUT, "cat.json"), JSON.stringify(data, null, 2) + "\n");
console.log("cat.json:", Object.keys(data).join(", ") || "nothing yet");
