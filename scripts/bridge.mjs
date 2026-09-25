/* ==================================================================
   THE BRIDGE: HERO -> ABOUT

   Turns the 180 supplied frames in public/hero-about_anime.zip into
   120 graded WebPs at public/scene/bridge/frame-NNN.webp, which the
   About section scrubs with the scrollbar.

   Run: node scripts/bridge.mjs

   ------------------------------------------------------------------
   IT READS STRAIGHT OUT OF THE ZIP. `unzip -p` writes one JPEG to
   stdout and ffmpeg takes it on stdin. Extracting 180 JPGs first would
   put another 14.6 MB somewhere, and if that somewhere were public/ it
   would ship to production forever without ever being fetched. Piping
   sidesteps the question.

   ------------------------------------------------------------------
   WHAT THE SOURCE ACTUALLY IS, measured before any of this was built.

   1. IT GENUINELY BRIDGES. Frame 001 is the hero's shot — the same
      signs, the same lantern, the same framing as new_hero_dark_loop —
      and by frame 108 the camera has arrived at the About bridge with
      the figure standing on it. Both ends line up with the clip they
      hand over to, which is the only reason any of this works.

   2. THE CAMERA COMES TO A COMPLETE STOP. Mean luma change per frame:

         f001-010   4.778      f091-100  12.893
         f041-050   7.279      f121-130   7.559
         f071-080  17.546      f141-150   2.032
         f081-090  13.276      f161-170   0.185   <- dead

      The last eighteen frames are the same picture repeated, so the
      source range used here is 1..162 and nothing is lost. That settle
      is also the beat About's copy arrives on.

   3. ITS TONE ALREADY MATCHES. ITS COLOUR DOES NOT.

      Measured through RGB — which is what the browser composites, and
      the only comparison that means anything here:

                          black  white    sat
         hero video          21    147  29.08
         f001 raw            20    147  25.89     <- tone matches
         About video          5    108  21.00
         f162 raw             6    111  17.15     <- tone matches

      Black and white land within 1-3 levels at both ends with no
      correction at all. What is off is saturation: the frames run 11%
      flat at the hero end and 18% flat at the About end, which is what
      a trip through a GIF's 256-colour palette does to neon.

   ------------------------------------------------------------------
   A TRAP THAT COST ME A WHOLE BUILD, recorded so it does not cost
   another one.

   The source JPEGs are yuvj420p — FULL range, 0-255. The two videos are
   yuv420p — LIMITED range, 16-235. Measure one of each with signalstats
   and the numbers are not on the same scale, and nothing warns you.

   I first measured the raw frames in full range, compared them against
   limited-range video numbers, and concluded the blacks were crushed by
   15 levels. They were not. 33 in full range IS 16 + 33*219/255 = 44 in
   limited range — and when I measured the built frames I got 45, which
   is the round trip, not a fault. I then "fixed" a problem that did not
   exist, pushing blacks from 20 to 32 at one end and 6 to 21 at the
   other, away from targets of 21 and 5.

   Every measurement here now goes through
       scale=...,format=rgb24,format=yuvj420p,signalstats
   applied identically to the WebPs and to the videos, so both are
   normalised to what the compositor sees. Compare like with like or do
   not compare.
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

const ZIP = resolve("public/hero-about_anime.zip");
const OUT_DIR = resolve("public/scene/bridge");

/* Source facts. 180 frames in the zip, named ezgif-frame-NNN.jpg,
   1920x1080. */
const SRC_LAST = 162;   // 163..180 are the dead tail, see above
const COUNT = 120;      // what we ship

/* NATIVE 1920x1080. No scaling happens at all: the source is 1080p and
   it stays 1080p.

   This started at 1440x810, the LG preset every other sequence on the
   site uses, on the assumption that 1080p would cost far more. Measured,
   it does not — WebP's cost here is set by how much real detail the
   picture contains, and the source's detail is already capped by having
   been through a GIF palette and a JPEG, so the extra pixels are largely
   redundant and compress away. Combined with the denoising below, which
   makes the files smaller still, native 1080p came out at ~125 KB a
   frame against 1440's ~135 KB.

   Cheaper AND sharper, because 1440 was being upscaled in use: a
   cover-fit 16:9 plate renders at 1600x900 in a 1440-wide window and at
   1920x1080 in a maximised one, so the old set was stretched 1.11x to
   1.33x. At native there is no upscale at all.

   The set is fetched ONCE, not twice, because the bridge is theme-neutral
   and Journey asks useFrameSequence for it without a `theme`. */
const W = 1920;
const H = 1080;

/* ---- clean it up before sharpening it -------------------------------
   THE GRAIN IS COMPRESSION ARTEFACTS, and the first version of this
   script was making them worse.

   The source has been through two lossy stages — a GIF and then JPEG,
   courtesy of ezgif — and what survives is 8x8 blocking with mosquito
   noise around it, heaviest in the dark low-detail areas: the stone
   embankment, the foliage, the shadow under the bridge. Measured in a
   patch of that stone against a patch of the railing, so real edges and
   artefacts can be told apart:

                                      artefacts  real edges   ratio
         unsharp=0.42 (first version)     5.84       7.27      1.245
         no sharpening at all             4.71       5.96      1.265
         deblock + cas                    4.96       6.47      1.304
         deblock + hqdn3d + cas           4.96       6.59      1.329
     >   deblock + nlmeans + cas          3.06       4.32      1.410

   The first version had the WORST ratio of the five. unsharp is
   indiscriminate: it multiplies edge contrast wherever it finds it, and
   a blocking artefact is an edge. It bought definition and paid for it
   in crust, one for one.

   So: deblock the 8x8 grid first (it has to run at native resolution,
   where those blocks actually are), then nlmeans for the mosquito noise
   around it — non-local means is slow but it is the right tool for
   compression noise, comparing patches rather than neighbouring pixels.

   Only then sharpen, and with cas rather than unsharp. Contrast Adaptive
   Sharpen weights by local contrast, so it leaves flat areas alone
   instead of hunting for texture in them. */
const DENOISE = "deblock=filter=strong:block=8,nlmeans=s=4.0:p=5:r=11";
const SHARPEN = "cas=0.6";

/* ---- the grade ------------------------------------------------------
   Chroma only, and RAMPED across the sequence. Nothing touches luma,
   because nothing needs to: black and white land at 18/145 and 4/109
   against targets of 21/147 and 5/108 with no correction at all.

   The frames run flat next to the clips they hand over to — a GIF's 256
   colours do that to neon — but not by the same amount at each end, and
   that is why this is a ramp and not a number. Measured against both
   targets through the finished encode:

                        target      x1.17     x1.22     x1.28
         f001 sat        29.08       28.85     29.71     31.67
         f162 sat        21.00       18.66     19.06     20.55

   No single scalar fits. 1.17 lands the hero end almost exactly and
   leaves the About end 11% flat; 1.28 does the reverse. Both ends
   crossfade into a DIFFERENT video, so a mismatch at either is visible
   at exactly the moment it matters most.

   Since frames are rendered one at a time, the multiplier can simply be
   a function of the frame — fitted to each endpoint and interpolated.
   The scene really does change from a neon street to a quiet canal over
   these 120 frames, so a gradual shift is not a compromise, it is the
   footage. Across 300svh of scrolling it is imperceptible as a change
   and correct at both ends.

   Placement was tested too: saturation before the denoiser versus after
   came out identical (28.87 against 28.85), so it sits last, where the
   denoiser is at least working on unboosted chroma. */
const SAT_AT_START = 1.18;
const SAT_AT_END = 1.31;

const saturationFor = (i) =>
    (SAT_AT_START + ((i - 1) / (COUNT - 1)) * (SAT_AT_END - SAT_AT_START)).toFixed(4);

/* ---- the watermark ---------------------------------------------------
   The source carries the generator's sparkle in the lower right, already
   blotted out upstream with a flat dark disc — which is its own mark, a
   black spot sitting on the railing in every frame. From about source
   frame 138 a grey shard of the sparkle also shows past the disc's upper
   right, and it DRIFTS: measured on a 10px grid at frames 140-160 it
   slides from (1787-1812, 790) down to (1762-1792, 870).

   The disc was located by what does not move: across 24 frames spread
   through a clip in which everything else moves, the only still pixels
   in that corner form an 82x83 disc at (1701, 849). The shard cannot be
   found that way because it moves, so it gets a box covering its whole
   path — and only on the frames it appears in, so the other 80% of the
   clip keeps the tighter fill. Checked absent at 115, 122, 128, 133, 137.

   removelogo, not delogo. delogo fills a whole RECTANGLE by interpolating
   its edges, which on a railing lit by lanterns dragged streaks of light
   straight through the box. removelogo fills only the pixels of a shaped
   mask, blurring in from their surroundings, so the fill follows the
   railing's own light instead of smearing it. It runs FIRST, on the raw
   source, so the denoiser and the grade treat the patch like any other
   part of the picture. */
const DISC = "lte(hypot(X-1742,Y-890),47)";
const MASK = maskFile("bridge", 1920, 1080, `if(${DISC},255,0)`);
const MASK_LATE = maskFile("bridge-late", 1920, 1080,
    `if(${DISC}+between(X,1756,1818)*between(Y,782,876),255,0)`);
const SHARD_FROM = 138;

const filterFor = (i) =>
    `removelogo=${sourceFor(i) >= SHARD_FROM ? MASK_LATE : MASK},` +
    `${DENOISE},${SHARPEN},eq=saturation=${saturationFor(i)}`;

/* Same encoder settings as every other sequence on the site. */
const ENC = ["-c:v", "libwebp", "-quality", "78", "-compression_level", "6"];

const pad = (n) => String(n).padStart(3, "0");

/* Which source frame backs output frame i (1-based, 1..COUNT).
   Maps 1..COUNT evenly onto 1..SRC_LAST. */
const sourceFor = (i) =>
    1 + Math.round(((i - 1) / (COUNT - 1)) * (SRC_LAST - 1));

function renderOne(i) {
    const src = sourceFor(i);
    const out = join(OUT_DIR, `frame-${pad(i)}.webp`);

    return new Promise((ok, fail) => {
        const uz = spawn("unzip", ["-p", ZIP, `ezgif-frame-${pad(src)}.jpg`]);
        const ff = spawn("ffmpeg", [
            "-v", "error", "-y",
            /* The JPEG arrives on stdin rather than as a file. */
            "-f", "image2pipe", "-i", "pipe:0",
            "-frames:v", "1",
            "-vf", filterFor(i),
            ...ENC,
            out,
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
            code === 0 ? ok() : fail(new Error(`frame ${i} (src ${src}): ${err.trim()}`)),
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
    await Promise.all(
        Array.from({ length: workers }, run),
    );
}

if (!existsSync(ZIP)) {
    console.error(`missing source: ${ZIP}`);
    process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const workers = Math.max(2, Math.min(6, cpus().length - 1));
console.log(
    `bridge: ${COUNT} frames from source 1..${SRC_LAST}, ` +
    `native ${W}x${H} (no scaling), ${workers} workers` +
    `\nnlmeans is slow by design — expect around a minute`,
);

const jobs = Array.from({ length: COUNT }, (_, k) => () => renderOne(k + 1));
await pool(jobs, workers);

const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webp"));
const total = files.reduce((n, f) => n + statSync(join(OUT_DIR, f)).size, 0);
console.log(
    `\nwrote ${files.length} frames to ${OUT_DIR}` +
    `\n${(total / 1048576).toFixed(2)} MB total, ` +
    `${Math.round(total / files.length / 1024)} KB average`,
);
