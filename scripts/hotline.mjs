/* ==================================================================
   THE HOTLINE: THE CONTACT SECTION'S CAMERA MOVE

   Turns the 290 supplied frames in public/contact_draft_1.zip into 290
   WebPs at public/scene/hotline/frame-NNN.webp, plus a smaller set under
   sm/, which Contact scrubs with the scrollbar. Also converts
   public/red-hotline-1920x1080.png — the same shot as frame 1, clean and
   at 1080p — into public/scene/hotline/still.webp: the first paint while
   the frames load, and the whole backdrop under reduced motion.

   Run: node scripts/hotline.mjs

   ------------------------------------------------------------------
   A SIBLING OF scripts/descent.mjs, and deliberately a plain one. Same
   provenance (ezgif: a GIF palette, then JPEG), same pipe-from-zip, same
   denoise chain and encoder. What it does NOT have is a grade: the
   descent had to match a clip on each side of it, and this has nothing
   either side to match — it opens out of a fully black screen and ends
   under a blurred form.

   WHAT THE SOURCE IS. 290 frames, 3840x2160 JPEG — the same shot as the
   first draft's 300 frames at 1280x720, re-supplied at 4K with ten
   frames fewer, dropped through the second half (old frame 150 is new
   147, old 300 is new 290; frames up to 45 are unchanged). A camera
   dollying down a
   marble runway toward a red phone on a pedestal in a black void. The
   phone stays inside x 45-55% throughout; at frame 150 — the section's
   lock point, frame 145 — the top of the phone is at about 25% of the frame height,
   which is what leaves room for a word on the back wall above it. From
   about frame 250 a hand reaches in and lifts the receiver.

   SHIPPED AT 1080p, NOT 4K. Scaled to 1920x1080 (and 1280 wide for
   phones, which see only a centre crop of the frame and so get the
   detail back). 4K frames would be several times the download for a
   difference no screen shows while they flicker past at scroll speed.
   The downscale comes first: it is what cleans the JPEG, so the denoise
   after it is light — the first draft's heavy one would smear marble
   that is now genuinely there.
   ================================================================== */

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { cpus, tmpdir } from "node:os";

/* A white-on-black mask the size of the frame, drawn by a geq expression
   into the temp directory, returned as a path ffmpeg's filter parser will
   accept. A Windows drive colon is escaped TWICE: the filtergraph parser
   strips one backslash and the filter's own option parser strips the
   other. Same helper as scripts/descent.mjs. */
function maskFile(name, w, h, expr) {
    const out = join(tmpdir(), `wm-mask-${name}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y",
        "-f", "lavfi", "-i", `color=black:s=${w}x${h}:d=1,format=gray`,
        "-vf", `geq=lum='${expr}'`, "-frames:v", "1", out]);
    return out.replace(/\\/g, "/").replace(/:/g, "\\\\:");
}

const ZIP = resolve("public/contact_draft_1.zip");
const STILL_SRC = resolve("public/red-hotline-1920x1080.png");
const OUT_DIR = resolve("public/scene/hotline");
const SM_DIR = join(OUT_DIR, "sm");

const COUNT = 290;
const W = 1920;
const H = 1080;

/* The phone set, for the same reason descent.mjs gives one: most phones
   fall under wantsSmallSet()'s 1400 physical pixels. */
const SM_W = 1280;
const SM_QUALITY = "72";

const SCALE = `scale=${W}:${H}:flags=lanczos`;
const DENOISE = "nlmeans=s=1.5:p=5:r=9";
const SHARPEN = "cas=0.4";

/* ---- the watermark ---------------------------------------------------
   The generator's sparkle, in every frame: a translucent grey four-point
   star centred at (3480, 1800) of the 4K source, arms reaching ~72px —
   exactly three times the first draft's (1160, 600), so the same mark in
   the same place. At the 1080p it is removed at, that is (1740, 900),
   r 44. It sits on pure black, so removelogo's fill is simply more
   black: the one place in the whole site the removal is invisible.
   Straight after the downscale, before anything else touches it. */
const MASK = maskFile("hotline-1080", W, H, "if(lte(hypot(X-1740,Y-900),44),255,0)");

const FILTER = `${SCALE},removelogo=${MASK},${DENOISE},${SHARPEN}`;
const ENC = ["-c:v", "libwebp", "-quality", "78", "-compression_level", "6"];
const pad = (n) => String(n).padStart(3, "0");

/* One denoise pass per frame, split into both sizes. */
function renderOne(i) {
    const name = `frame-${pad(i)}.webp`;
    return new Promise((ok, fail) => {
        const uz = spawn("unzip", ["-p", ZIP, `ezgif-frame-${pad(i)}.jpg`]);
        const ff = spawn("ffmpeg", [
            "-v", "error", "-y",
            "-f", "image2pipe", "-i", "pipe:0",
            "-filter_complex",
            `[0:v]${FILTER},split=2[full][small];[small]scale=${SM_W}:-2:flags=lanczos[sm]`,
            "-map", "[full]", "-frames:v", "1", ...ENC, join(OUT_DIR, name),
            "-map", "[sm]", "-frames:v", "1",
            "-c:v", "libwebp", "-quality", SM_QUALITY, "-compression_level", "6",
            join(SM_DIR, name),
        ]);
        let err = "";
        ff.stderr.on("data", (d) => { err += d; });
        uz.stderr.resume();
        uz.stdout.pipe(ff.stdin);
        /* ffmpeg closing stdin once it has its one frame is normal. */
        ff.stdin.on("error", () => { });
        uz.on("error", fail);
        ff.on("error", fail);
        ff.on("close", (code) =>
            code === 0 ? ok() : fail(new Error(`frame ${i}: ${err.trim()}`)),
        );
    });
}

async function pool(jobs, workers) {
    let next = 0;
    let done = 0;
    const run = async () => {
        for (;;) {
            const i = next++;
            if (i >= jobs.length) return;
            await jobs[i]();
            done += 1;
            if (done % 30 === 0 || done === jobs.length) {
                process.stdout.write(`  ${done}/${jobs.length}\n`);
            }
        }
    };
    await Promise.all(Array.from({ length: workers }, run));
}

const megs = (dir) => {
    const files = readdirSync(dir).filter((f) => f.startsWith("frame-") && f.endsWith(".webp"));
    const total = files.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
    return { n: files.length, mb: total / 1048576, kb: total / files.length / 1024 };
};

for (const src of [ZIP, STILL_SRC]) {
    if (!existsSync(src)) {
        console.error(`missing source: ${src}`);
        process.exit(1);
    }
}
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SM_DIR, { recursive: true });

const workers = Math.max(2, Math.min(6, cpus().length - 1));
console.log(`hotline: ${COUNT} frames, native ${W}x${H} plus ${SM_W}-wide sm/, ${workers} workers`);

await pool(Array.from({ length: COUNT }, (_, k) => () => renderOne(k + 1)), workers);

/* The still. The PNG is already clean — no watermark — and at 1080p, so
   it only needs encoding; quality 82 because it is a single image that
   is looked at, not one of three hundred that flicker past. */
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", STILL_SRC,
    "-c:v", "libwebp", "-quality", "82", "-compression_level", "6",
    join(OUT_DIR, "still.webp")]);

const full = megs(OUT_DIR);
const small = megs(SM_DIR);
console.log(
    `\nwrote ${full.n} frames to ${OUT_DIR}` +
    `\n  full  ${full.mb.toFixed(2)} MB total, ${Math.round(full.kb)} KB average` +
    `\n  sm    ${small.mb.toFixed(2)} MB total, ${Math.round(small.kb)} KB average` +
    `\n  still ${Math.round(statSync(join(OUT_DIR, "still.webp")).size / 1024)} KB`,
);
