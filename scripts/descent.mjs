/* ==================================================================
   THE DESCENT: ABOUT -> PROJECTS

   Turns the 240 supplied frames in public/about_trans.zip into 240
   graded WebPs at public/scene/descent/frame-NNN.webp, plus a half-size
   set under sm/, which Journey scrubs with the scrollbar after the
   About clip stops.

   Run: node scripts/descent.mjs

   ------------------------------------------------------------------
   THIS IS A SIBLING OF scripts/bridge.mjs, NOT A REFACTOR OF IT.

   Same provenance (ezgif: a GIF palette, then JPEG), same pipe-from-zip
   trick, same encoder, same denoise chain — but every constant below was
   re-measured on THIS footage rather than inherited, and two of them came
   out different. Generalising the two scripts into one would put a
   working file at risk to save thirty lines, which is the same call
   about-loop.mjs made about hero-loop.mjs.

   The yuvj420p full-range trap that bridge.mjs records at length applies
   here unchanged: every measurement below goes through
       format=rgb24,format=yuvj420p,signalstats
   applied identically to the WebPs, the videos and the PNG, so all three
   are normalised to what the compositor sees.

   ------------------------------------------------------------------
   WHAT THE SOURCE ACTUALLY IS, measured before any of this was built.

   1. BOTH ENDS LINE UP, which is the only reason any of this works.

      Frame 001 is the About clip's shot — the same bridge, the same
      figure, the same framing as the last frame of new_about_loop.mp4.

      Frame 240 is not merely similar to public/project_bg.png, it IS
      that picture. Measured raw:

                          YLOW  YAVG  YHIGH    SAT
         f240               33  58.81     96  13.85
         project_bg.png     33  58.86     97  14.66

      Black identical, average within 0.1%, white within one level. The
      clip was rendered from the same art the Projects section already
      uses as its background, so the join under the seam is honest and
      the tail needs no reframing.

   2. THE CAMERA COMES TO REST, but it is not dead. Mean luma change
      across five-frame steps:

         f001-006  20.56      f150-155  22.75
         f030-035  29.40      f180-185  19.44
         f060-065  24.63      f205-210   8.41   <- braking
         f090-095  19.18      f225-230   1.19
         f120-125  18.92      f235-240   0.56   <- at rest

      Unlike the bridge source, whose last eighteen frames were the same
      picture repeated and were dropped, this settles rather than stops
      dead: 0.56 against the bridge's 0.185. All 240 ship, and the
      settled tail is the beat the section holds on while the seam
      arrives.

   3. ITS TONE ALREADY MATCHES. ITS COLOUR DOES NOT. Same finding as the
      bridge, same cause, and measured the same way — against the last
      frame of the clip it takes over from:

                        YLOW  YAVG  YHIGH    SAT
         About video       5  47.40    116  20.97
         f001 raw          7  49.33    113  16.94    <- tone matches

      Luma lands within two levels at both ends with no correction at
      all. Saturation is 19% flat, which is what a trip through a 256
      colour palette does to lantern light on wet stone.

   ------------------------------------------------------------------
   THE FILTER CHAIN WAS RE-TESTED, NOT ASSUMED.

   Sobel energy in a flat patch of sky (artefacts) against a patch of
   the bridge railing (real edges), on frame 001:

                                  artefacts  real edges   ratio
         unsharp=0.42                  9.09      57.90    6.372
         no filtering at all           7.75      52.44    6.764
         deblock + cas                 7.78      54.76    7.035
     >   deblock + nlmeans + cas       5.99      48.11    8.029

   The same ordering bridge.mjs found on its own footage, including the
   part that matters: unsharp scores WORSE than doing nothing. It
   multiplies edge contrast wherever it finds it, and a blocking
   artefact is an edge.
   ================================================================== */

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { cpus, tmpdir } from "node:os";

/* A white-on-black mask the size of the frame, drawn by a geq expression
   into the temp directory, returned as a path ffmpeg's filter parser will
   accept. A Windows drive colon is escaped TWICE: the filtergraph parser
   strips one backslash and the filter's own option parser strips the
   other, so a single escape still ended the argument at the colon. */
function maskFile(name, w, h, expr) {
    const out = join(tmpdir(), `wm-mask-${name}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y",
        "-f", "lavfi", "-i", `color=black:s=${w}x${h}:d=1,format=gray`,
        "-vf", `geq=lum='${expr}'`, "-frames:v", "1", out]);
    return out.replace(/\\/g, "/").replace(/:/g, "\\\\:");
}

const ZIP = resolve("public/about_trans.zip");
const OUT_DIR = resolve("public/scene/descent");
const SM_DIR = join(OUT_DIR, "sm");

/* Source facts. 240 frames in the zip, named ezgif-frame-NNN.jpg,
   1280x720. Every one of them ships, one for one — see finding 2, and
   the decision to scrub all 240 across 300svh. */
const COUNT = 240;

/* NATIVE 1280x720. No scaling, for the same reason bridge.mjs keeps
   1080p: the source's detail is already capped by the GIF palette and
   the JPEG, so there is nothing to gain by resampling and something to
   lose. It also matches new_about_loop.mp4 exactly, which is the clip
   this set takes the frame over from — so nothing sharpens or softens
   at the handover, which would be visible precisely because the two
   pictures are the same composition. */
const W = 1280;
const H = 720;

/* ---- the small set --------------------------------------------------
   THE BRIDGE SET DELIBERATELY HAS NONE, AND THIS ONE DOES. That is not
   an inconsistency, it is the count: useFrameSequence's wantsSmallSet()
   fires below 1400 physical pixels, which is most phones, and 240 frames
   at full size is ~13 MB against the bridge's 120 at ~15 MB. Asking a
   phone to pull 13 MB for a camera move is a different proposition from
   asking it for 6, so phones get 854x480 at quality 72 — ~7 MB, and no
   visible loss at that density. */
const SM_W = 854;
const SM_QUALITY = "72";

const DENOISE = "deblock=filter=strong:block=8,nlmeans=s=4.0:p=5:r=11";
const SHARPEN = "cas=0.6";

/* ---- the grade ------------------------------------------------------
   Chroma only, ramped, and fitted THROUGH THE FINISHED ENCODE rather
   than on the raw frame — the denoiser takes chroma out on its way past,
   so a multiplier fitted on the source lands short. Measured on the
   actual WebP:

                       head (f001)            tail (f240)
         target            20.97                   14.66
         x1.00             16.32                   13.41
         x1.10                 -                   13.84
         x1.18             18.03                   14.02
         x1.20                 -                   14.84   <-
         x1.24             19.53
         x1.30             20.12
         x1.36             20.92   <-
         x1.42             22.48

   1.36 lands the head at 20.92 against 20.97. 1.20 overshoots the tail
   by 1.2% where 1.18 undershoots by 4%, so 1.20 it is.

   THE RAMP RUNS DOWNWARD HERE, where the bridge's runs up (1.18 -> 1.31).
   The two ends hand over to different things — a lantern-lit canal at
   one end, a misty valley at the other — and the correction each needs
   is a property of what it is handing over TO, not of the footage. */
const SAT_AT_START = 1.36;
const SAT_AT_END = 1.20;

const saturationFor = (i) =>
    (SAT_AT_START + ((i - 1) / (COUNT - 1)) * (SAT_AT_END - SAT_AT_START)).toFixed(4);

/* ---- the watermark ---------------------------------------------------
   The generator's sparkle sits in the lower right of every frame: a
   translucent grey four-point star, 50x50px, centred at (1160, 600).
   Measured on a 10px grid at frames 1, 60 and 120 — it does not move.
   (The still-pixel method bridge.mjs uses cannot find it here: this
   clip's last thirty frames barely move at all, so the whole corner
   reads as still.)

   removelogo over a circular mask 4px wider than the star, for the same
   reason as the bridge: it fills only the masked pixels from their
   surroundings, where delogo's rectangle dragged the lantern light
   into streaks. First in the chain, on the raw source. */
const MASK = maskFile("descent", 1280, 720, "if(lte(hypot(X-1160,Y-600),29),255,0)");

const filterFor = (i) =>
    `removelogo=${MASK},${DENOISE},${SHARPEN},eq=saturation=${saturationFor(i)}`;

/* Same encoder settings as every other sequence on the site. */
const ENC = ["-c:v", "libwebp", "-quality", "78", "-compression_level", "6"];

const pad = (n) => String(n).padStart(3, "0");

/* One pass over the source JPEG produces BOTH sizes. nlmeans is by far
   the most expensive thing here, so running it once and splitting the
   result afterwards halves the run rather than trimming it. */
function renderOne(i) {
    const name = `frame-${pad(i)}.webp`;

    return new Promise((ok, fail) => {
        const uz = spawn("unzip", ["-p", ZIP, `ezgif-frame-${pad(i)}.jpg`]);
        const ff = spawn("ffmpeg", [
            "-v", "error", "-y",
            /* The JPEG arrives on stdin rather than as a file. */
            "-f", "image2pipe", "-i", "pipe:0",
            "-filter_complex",
            `[0:v]${filterFor(i)},split=2[full][small];` +
            `[small]scale=${SM_W}:-2[sm]`,
            "-map", "[full]", "-frames:v", "1", ...ENC, join(OUT_DIR, name),
            "-map", "[sm]", "-frames:v", "1",
            "-c:v", "libwebp", "-quality", SM_QUALITY, "-compression_level", "6",
            join(SM_DIR, name),
        ]);

        let err = "";
        ff.stderr.on("data", (d) => { err += d; });
        uz.stderr.resume();

        uz.stdout.pipe(ff.stdin);
        /* ffmpeg closing stdin early is normal once it has its one frame;
           without this the pipe raises EPIPE and takes the run down. */
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
            if (done % 20 === 0 || done === jobs.length) {
                process.stdout.write(`  ${done}/${jobs.length}\n`);
            }
        }
    };
    await Promise.all(Array.from({ length: workers }, run));
}

const megs = (dir) => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));
    const total = files.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
    return { n: files.length, mb: total / 1048576, kb: total / files.length / 1024 };
};

if (!existsSync(ZIP)) {
    console.error(`missing source: ${ZIP}`);
    process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(SM_DIR, { recursive: true });

const workers = Math.max(2, Math.min(6, cpus().length - 1));
console.log(
    `descent: ${COUNT} frames, native ${W}x${H} plus ${SM_W}-wide sm/, ` +
    `saturation ${SAT_AT_START} -> ${SAT_AT_END}, ${workers} workers` +
    `\nnlmeans is slow by design — expect a few minutes`,
);

const jobs = Array.from({ length: COUNT }, (_, k) => () => renderOne(k + 1));
await pool(jobs, workers);

const full = megs(OUT_DIR);
const small = megs(SM_DIR);
console.log(
    `\nwrote ${full.n} frames to ${OUT_DIR}` +
    `\n  full  ${full.mb.toFixed(2)} MB total, ${Math.round(full.kb)} KB average` +
    `\n  sm    ${small.mb.toFixed(2)} MB total, ${Math.round(small.kb)} KB average`,
);
