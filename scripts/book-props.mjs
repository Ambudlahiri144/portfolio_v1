#!/usr/bin/env node
/* ==================================================================
   BOOK PROPS — the still images the light theme's interactions use.

     node scripts/book-props.mjs

   In:  assets-src/book/props/   the supplied GPT images
   Out: public/book/props/       what the site loads

   - wax-seal.webp          trimmed to its alpha, for the envelope
   - envelope-body.webp     the envelope's back, cut out of its backdrop
   - envelope-flap.webp     the open flap, cut to its triangle so it can
                            be hinged shut in CSS 3D
   - cardstock/laid/maple/typeside.webp   tileable textures, 1024 px

   The envelope is cut with geometric masks rather than a colour key: the
   sand backdrop and the laid paper are within a few levels of each
   other, so any key eats the paper. The rectangle and the flap's
   triangle were measured on the source (edges at x 348/1306, fold at
   y 344, bottom at y 842, apex at x 836, y 35).
   ================================================================== */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "assets-src/book/props");
const OUT = join(ROOT, "public/book/props");
mkdirSync(OUT, { recursive: true });

const ffmpeg = (argv) => execFileSync("ffmpeg", ["-v", "error", "-y", ...argv], { stdio: "inherit" });
const src = (f) => join(SRC, f);
const out = (f) => join(OUT, f);

/* Seal: square crop around its alpha bounds, then down to a size that is
   still sharp at twice its largest on-screen size. */
ffmpeg([
    "-i", src("wax-seal.png"),
    "-vf", "crop=928:928:375:3,scale=360:360:flags=lanczos,format=rgba",
    "-c:v", "libwebp", "-quality", "88", "-lossless", "0", out("wax-seal.webp"),
]);

/* Envelope body: a plain rectangle. */
const ENV = { x: 348, right: 1306, fold: 344, bottom: 842, apexX: 836, apexY: 35 };
const bodyW = ENV.right - ENV.x;
const bodyH = ENV.bottom - ENV.fold;
ffmpeg([
    "-i", src("envelope.png"),
    "-vf", `crop=${bodyW}:${bodyH}:${ENV.x}:${ENV.fold},scale=640:-2:flags=lanczos`,
    "-c:v", "libwebp", "-quality", "82", out("envelope-body.webp"),
]);

/* Envelope flap: the triangle above the fold, alpha from its two straight
   edges with a one-pixel soft edge. */
const flapH = ENV.fold - ENV.apexY;
const ax = ENV.apexX - ENV.x;
const left = ax;
const right = bodyW - ax;
const edge = `(${0}+${flapH}*if(lt(X,${ax}),(${ax}-X)/${left},(X-${ax})/${right}))`;
ffmpeg([
    "-i", src("envelope.png"),
    "-vf",
    [
        `crop=${bodyW}:${flapH}:${ENV.x}:${ENV.apexY}`,
        "format=rgba",
        `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*clip((Y-${edge})/1.5+0.5,0,1)'`,
        "scale=640:-2:flags=lanczos",
    ].join(","),
    "-c:v", "libwebp", "-quality", "82", out("envelope-flap.webp"),
]);

/* The About portrait: a pencil drawing on a transparent ground, supplied as
   public/book/props/light.png. Kept transparent; the print it sits in
   gives it a drawing-paper ground in CSS. */
ffmpeg([
    "-i", join(ROOT, "public/book/props/light.png"),
    "-vf", "scale=560:-2:flags=lanczos,format=rgba",
    "-c:v", "libwebp", "-quality", "84", out("portrait.webp"),
]);

/* The same drawing's line work alone, for the draw-in: its edges, as
   graphite-coloured lines on a transparent ground. The page shows these
   first, then the shading is laid in over them. */
ffmpeg([
    "-f", "lavfi", "-i", "color=c=0x2b2622:s=661x655",
    "-i", join(ROOT, "public/book/props/light.png"),
    "-filter_complex",
    [
        /* Flatten the drawing onto white so its transparent ground has no
           edge of its own. Blur before finding edges: the drawing is cross-
           hatched, and unblurred every hatch stroke became an edge. At this
           radius the hatching merges into tone and only contours remain. */
        "color=c=white:s=661x655[w]",
        "[w][1:v]overlay,format=gray,gblur=sigma=2.4,edgedetect=low=0.10:high=0.30:mode=wires,gblur=sigma=0.6,curves=all='0/0 0.3/0.85 1/1'[edges]",
        "[0:v][edges]alphamerge,scale=560:-2:flags=lanczos,format=rgba",
    ].join(";"),
    "-frames:v", "1",
    "-c:v", "libwebp", "-quality", "86", out("portrait-lines.webp"),
]);

/* Project screenshots for the pop-up cards. On a 10 cm card 768 px is more
   than enough, and it is a quarter of the texture memory (and upload
   time) of the 1920 px originals the HTML prints use. */
mkdirSync(out("shots"), { recursive: true });
for (const name of ["murmur", "bail", "bu", "kine"]) {
    ffmpeg([
        "-i", join(ROOT, `public/projects/${name}.webp`),
        "-vf", "scale=768:-2:flags=lanczos",
        "-c:v", "libwebp", "-quality", "82", out(`shots/${name}.webp`),
    ]);
}

/* Bookcloth and leather for the shelf's volumes, cut from the cover of the
   book itself (K0): the same weave and hide, so the shelf and the book on
   the table are plainly the same bindery. The cloth is tinted per volume
   in the material. Swap in dedicated GPT textures by replacing these two
   files; nothing else changes. */
mkdirSync(out("shelf"), { recursive: true });
ffmpeg([
    "-i", join(ROOT, "assets-src/book/source/K0.png"),
    /* Pure weave: below the title panel, clear of the corners. */
    "-vf", "crop=300:300:960:430,scale=512:512:flags=lanczos",
    "-c:v", "libwebp", "-quality", "82", out("shelf/cloth.webp"),
]);
ffmpeg([
    "-i", join(ROOT, "assets-src/book/source/K0.png"),
    /* The leather spine, inside its highlighted edges. */
    "-vf", "crop=46:560:883:140,scale=128:1024:flags=lanczos",
    "-c:v", "libwebp", "-quality", "82", out("shelf/leather.webp"),
]);

/* Textures: tileable, so no crop — just size and compression. */
for (const [file, name] of [
    ["cardstock.png", "cardstock.webp"],
    ["laid-paper.png", "laid.webp"],
    ["maple-endgrain.png", "maple.webp"],
    ["type-sidegrain.png", "typeside.webp"],
]) {
    ffmpeg([
        "-i", src(file),
        "-vf", "scale=1024:1024:flags=lanczos",
        "-c:v", "libwebp", "-quality", "80", out(name),
    ]);
}

console.log("props written to public/book/props");
