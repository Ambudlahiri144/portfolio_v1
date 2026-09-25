/* ==================================================================
   ABOUT CLIP: SEAMLESS LOOP, NO AUDIO

   Turns public/new_about.mp4 into public/new_about_loop.mp4 and
   public/about-poster.webp. The source is never touched.

   Run: node scripts/about-loop.mjs

   ------------------------------------------------------------------
   A SIBLING TO scripts/hero-loop.mjs, NOT A REFACTOR OF IT.

   The two share a technique and nothing else. hero-loop.mjs carries a
   grade and a drift correction whose six constants are fitted to that
   clip's signal and are meaningless here, and it is the record of how
   a shipped asset was made. Generalising it would put a working file
   at risk to save fifteen lines.

   ------------------------------------------------------------------
   WHAT THIS CLIP NEEDED, measured rather than assumed.

   1. THE LOOP JUMPS, same as the hero's did. Adjacent frames move by
      0.93 luma on average; frame 191 to frame 0 moves 7.63, about 8.2
      ordinary frames of change landing in one. Every 8 seconds.

   2. IT HAS A STEREO AAC TRACK. "Mute it" is therefore a real saving
      and not just an attribute on the element — the audio is dropped
      here, so the bytes never ship at all.

   3. IT DOES **NOT** NEED A GRADE, and that is a measurement, not a
      shrug. The hero's clip fell 14% in saturation over its first two
      seconds, which is invisible on one play and glaring on a loop.
      This one, as 15-frame means:

         t=0.0   black 21.4   white 115.0   range 93.6   sat 19.08
         t=1.9   black 24.3   white 116.3   range 92.1   sat 18.36
         t=6.9   black 25.0   white 117.4   range 92.4   sat 18.42

      Range holds a ±0.8% band with no trend at all. Saturation falls
      3.5%, a quarter of the hero's. And the dissolve below removes even
      that from the loop point by construction: the output starts at
      source t=0.8 and ends dissolved into source t=0.8, so the first
      and last frames carry the same grade whatever it is. Correcting
      this would be adding a mechanism with its own error to fix
      something under the threshold of being seen.
   ================================================================== */

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

/* A white-on-black mask the size of the frame, drawn by a geq expression
   into the temp directory, returned as a path ffmpeg's filter parser will
   accept. A Windows drive colon is escaped TWICE: the filtergraph parser
   strips one backslash and the filter's own option parser strips the
   other. Same helper as scripts/bridge.mjs and scripts/descent.mjs. */
function maskFile(name, w, h, expr) {
    const out = join(tmpdir(), `wm-mask-${name}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y",
        "-f", "lavfi", "-i", `color=black:s=${w}x${h}:d=1,format=gray`,
        "-vf", `geq=lum='${expr}'`, "-frames:v", "1", out]);
    return out.replace(/\\/g, "/").replace(/:/g, "\\\\:");
}

const SRC = resolve("public/new_about.mp4");
const OUT = resolve("public/new_about_loop.mp4");
const POSTER = resolve("public/about-poster.webp");

/* Source facts, from ffprobe. 1280x720, 24fps — not the hero's 1080p30. */
const DURATION = 8.0;
const FPS = 24;

/* How long the tail dissolves into the head.

   0.8s is 19 frames at 24fps, which spreads the 7.63 jump to 0.40 per
   frame — under the 0.93 an ordinary frame already moves, so it lands
   below the threshold of being seen. It costs 0.8s of run time, since
   the loop is DURATION - FADE long. */
const FADE = 0.8;

/* A few frames of head beyond the fade, so xfade never reaches the
   boundary with its second input already exhausted. Measured, it also
   closes the loop tighter than an exactly-FADE-long head does. */
const HEAD_PAD = 4 / FPS;

/* Gentler than the hero's 0.5.

   This is a 720p source that will be upscaled about 1.25x to fill a
   1440-wide window, and on an upscale the failure mode of sharpening
   is ringing on the lantern edges rather than recovered detail. 0.4
   firms up the railings and the roof tiles without haloing. */
const SHARPEN = "unsharp=5:5:0.4:5:5:0";

/* Chosen by sweeping 21/23/25 against a near-lossless CRF 12 encode of
   the identical filter chain — the source itself is no use as a
   reference, because the loop pass shifts the timeline by FADE and the
   frames no longer line up.

         CRF 21   4.35 MB   SSIM 0.9872
         CRF 23   3.38 MB   SSIM 0.9827
         CRF 25   2.56 MB   SSIM 0.9769

   25, after checking the two places h264 gives up on this footage: the
   flat purple sky, where banding would show, and the paper lanterns,
   where ringing would. Both are indistinguishable from the reference at
   100%. It is a background with a scrim and type over it, which is the
   least exposed a picture can be. */
const CRF = "25";

/* Close the loop.

   Hold back the first FADE seconds and dissolve them onto the tail, so
   the last frame and the first frame are the same picture and the loop
   has nothing left to jump across.

   The source is opened TWICE rather than split once. A split feeds every
   frame to both branches and lets xfade decide when to read them, and
   xfade does not touch the head until it reaches the offset — so the
   graph sits on seconds of raw frames while it waits. On the hero that
   mistake cost fifteen minutes an encode against thirteen seconds for
   this shape. The second input is cut with -t BEFORE -i, so its decoder
   stops after a fraction of a second rather than reading the file again.

   HOW WELL IT CLOSES, and why not better. Frame-to-frame motion in the
   output, over all 173 steps: median 0.599, 90th percentile 1.033, and
   the largest step the clip contains naturally is 2.093. The loop point
   lands at about 2.3 — a fraction above the biggest movement already in
   the shot, against 7.63 before, which was three and a half times it.

   The remainder is structural and not worth chasing. The camera pushes
   in across the eight seconds, so the first and last frames are the same
   place at genuinely different scales, and a dissolve between two zoom
   levels always leaves a soft settle. Widening the fade to 1.2s was
   tested and came out WORSE (2.45), because a longer blend just holds
   the mismatch on screen for longer. What matters is that the transition
   now sits inside the envelope of motion the clip already has, so it
   reads as the camera moving rather than as a cut. */
const body = DURATION - FADE;
const offset = body - FADE;

/* ---- the watermark ---------------------------------------------------
   The generator's translucent sparkle sits in the lower right for the
   whole clip — the same mark scripts/descent.mjs removes from the frames
   that follow this clip on the page. Here it is centred at (1166, 602),
   arms reaching 22px, measured on a 10px grid and checked identical at
   four points across the eight seconds.

   removelogo over a circle 4px wider than the star: it fills only the
   masked pixels from their surroundings. It runs FIRST, before the
   sharpen, so the sharpen cannot put a halo on the star's edge before
   it is gone — and on BOTH inputs, because the head is dissolved onto
   the tail and would otherwise bring the mark back for 0.8s every loop.
   The poster below is taken from the output, so it is clean too. */
const MASK = maskFile("about", 1280, 720, "if(lte(hypot(X-1166,Y-602),26),255,0)");
const CLEAN = `removelogo=${MASK}`;

const filter =
    `[0:v]${CLEAN},${SHARPEN},trim=start=${FADE},setpts=PTS-STARTPTS[body];` +
    `[1:v]${CLEAN},${SHARPEN},setpts=PTS-STARTPTS[head];` +
    `[body][head]xfade=transition=fade:duration=${FADE}:offset=${offset}[v]`;

if (!existsSync(SRC)) {
    console.error(`missing source: ${SRC}`);
    process.exit(1);
}

console.log(`closing the loop — ${DURATION}s in, ${body}s out, crf ${CRF}`);

execFileSync(
    "ffmpeg",
    [
        "-v", "error", "-stats", "-y",
        "-i", SRC,
        "-t", String(FADE + HEAD_PAD), "-i", SRC,
        "-filter_complex", filter,
        "-map", "[v]",
        /* The whole point of "mute it": the AAC track is dropped, so the
           bytes never reach anyone. An element attribute would only stop
           it being played, not downloaded. */
        "-an",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", CRF,
        /* Variance-adaptive quantisation. Most of this frame is dark and
           flat — night sky, wet bridge deck — which is exactly where
           x264's default bit allocation starves detail into banding. */
        "-x264-params", "aq-mode=3",
        /* Two-second keyframes at 24fps. The browser never seeks this
           clip; this only caps how far quality drifts from an intra
           frame. */
        "-g", String(FPS * 2),
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        OUT,
    ],
    { stdio: "inherit" },
);

/* The poster, for the reduced-motion branch and as the first paint.
   Taken from the OUTPUT rather than the source, so it is the sharpened,
   post-dissolve first frame and matches what the video opens on exactly. */
execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", OUT, "-frames:v", "1", "-c:v", "libwebp",
     "-quality", "82", "-compression_level", "6", POSTER],
    { stdio: "inherit" },
);

const mb = (p) => (statSync(p).size / 1048576).toFixed(2);
const kb = (p) => (statSync(p).size / 1024).toFixed(0);
console.log(`\nwrote ${OUT}   ${mb(OUT)} MB  (source ${mb(SRC)} MB, with audio)`);
console.log(`wrote ${POSTER}   ${kb(POSTER)} KB`);
