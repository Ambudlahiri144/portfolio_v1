#!/usr/bin/env node
/* ==================================================================
   BOOK PEN — the fountain pen sprite that writes the light theme's text.

     node scripts/book-pen.mjs [path/to/pen.png] [out/dir]

   In:  assets-src/book/props/pen.png   (the GPT-6 Astra image: a pen on a
        transparent ground, any angle; see the prompt in the light theme's
        plan / components/book/pen/PenLayer.tsx)
   Out: public/book/props/pen.webp      trimmed, 1024 px on its long side
        public/book/props/pen.json      where its nib is, and which way it
                                        points, for PenLayer

   The pen's axis comes from the moments of its alpha, and the nib is the
   narrower end of that axis; the tip is the farthest opaque pixel there.
   So a slightly different pose from the generator still works: PenLayer
   rotates by the difference between `angle` and the pose it wants.
   Until this has been run, pen.json is `null` and a drawn pen stands in.
   ================================================================== */

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const input = resolve(process.argv[2] ?? join(ROOT, "assets-src/book/props/pen.png"));
const OUT = resolve(process.argv[3] ?? join(ROOT, "public/book/props"));

if (!existsSync(input)) {
    console.error(`No pen image at ${input}. Generate it first, then run this again.`);
    process.exit(1);
}

const [W, H] = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", input,
]).toString().trim().split(",").map(Number);

/* Analyse a small copy of the alpha: plenty for an axis and a tip. */
const A = 640;
const k = A / Math.max(W, H);
const aw = Math.round(W * k);
const ah = Math.round(H * k);
const alpha = execFileSync("ffmpeg", [
    "-v", "error", "-i", input,
    "-vf", `scale=${aw}:${ah}:flags=area,format=rgba,alphaextract`,
    "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1",
], { maxBuffer: 64 << 20 });

const on = (x, y) => alpha[y * aw + x] > 127;
let n = 0, sx = 0, sy = 0, minX = aw, minY = ah, maxX = 0, maxY = 0;
for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    if (!on(x, y)) continue;
    n++; sx += x; sy += y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
}
if (n < 50) {
    console.error("The image has almost no opaque pixels: is its background transparent?");
    process.exit(1);
}
const cx = sx / n, cy = sy / n;
let xx = 0, yy = 0, xy = 0;
for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (!on(x, y)) continue;
    xx += (x - cx) ** 2; yy += (y - cy) ** 2; xy += (x - cx) * (y - cy);
}
/* The major axis of the pixel cloud. */
const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
const ux = Math.cos(theta), uy = Math.sin(theta);

/* Along the axis: its two ends, and how wide the pen is near each. */
let tMin = Infinity, tMax = -Infinity;
for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (!on(x, y)) continue;
    const t = (x - cx) * ux + (y - cy) * uy;
    if (t < tMin) tMin = t; if (t > tMax) tMax = t;
}
const band = (tMax - tMin) * 0.08;
const widthNear = (end) => {
    let lo = Infinity, hi = -Infinity;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        if (!on(x, y)) continue;
        const t = (x - cx) * ux + (y - cy) * uy;
        if (Math.abs(t - end) > band) continue;
        const s = -(x - cx) * uy + (y - cy) * ux;
        if (s < lo) lo = s; if (s > hi) hi = s;
    }
    return hi - lo;
};
const nibAtMin = widthNear(tMin + band) < widthNear(tMax - band);
const nibT = nibAtMin ? tMin : tMax;
const farT = nibAtMin ? tMax : tMin;

/* The tip: the opaque pixels at the very end, averaged across. */
let tx = 0, ty = 0, tn = 0;
for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    if (!on(x, y)) continue;
    const t = (x - cx) * ux + (y - cy) * uy;
    if (Math.abs(t - nibT) <= 1.5) { tx += x; ty += y; tn++; }
}
tx /= tn; ty /= tn;
const fx = cx + ux * farT, fy = cy + uy * farT;

/* Crop the full-size image to the pen, and bring it down to 1024 px. */
const pad = 4;
const cropX = Math.max(0, Math.floor(minX / k) - pad);
const cropY = Math.max(0, Math.floor(minY / k) - pad);
const cropW = Math.min(W - cropX, Math.ceil((maxX - minX + 1) / k) + pad * 2);
const cropH = Math.min(H - cropY, Math.ceil((maxY - minY + 1) / k) + pad * 2);
const s = 1024 / Math.max(cropW, cropH);
const outW = Math.round(cropW * s);
const outH = Math.round(cropH * s);
execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", input,
    "-vf", `crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${outW}:${outH}:flags=lanczos,format=rgba`,
    "-c:v", "libwebp", "-quality", "88", join(OUT, "pen.webp"),
], { stdio: "inherit" });

const toOut = (x, y) => [(x / k - cropX) * s, (y / k - cropY) * s];
const [tipX, tipY] = toOut(tx, ty);
const [endX, endY] = toOut(fx, fy);
const meta = {
    w: outW,
    h: outH,
    tip: [+tipX.toFixed(1), +tipY.toFixed(1)],
    /* Degrees, image axes (y down): the direction from the nib up the barrel. */
    angle: +((Math.atan2(endY - tipY, endX - tipX) * 180) / Math.PI).toFixed(2),
    length: +Math.hypot(endX - tipX, endY - tipY).toFixed(1),
};
writeFileSync(join(OUT, "pen.json"), JSON.stringify(meta, null, 4) + "\n");
console.log("pen.webp", `${outW}x${outH}`, "pen.json", meta);
