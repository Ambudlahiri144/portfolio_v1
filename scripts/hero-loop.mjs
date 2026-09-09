/* ==================================================================
   HERO CLIP: SEAMLESS LOOP + UNIFORM GRADE

   Turns public/new_hero_dark.mp4 into public/new_hero_dark_loop.mp4.
   The source is never touched.

   Run: node scripts/hero-loop.mjs

   ------------------------------------------------------------------
   WHY, measured rather than guessed. Three faults in the source, all
   of them visible once the clip is looping behind a landing page.

   1. THE LOOP JUMPS. Average luma change between adjacent frames runs
      about 0.5 through the whole clip, including the last frame — the
      motion does NOT ease to a stop, which was my first guess and was
      wrong. But frame 185 to frame 0 measures 6.33, roughly twelve
      ordinary frames of change landing in one. That is the jerk.

   2. THE FIRST TWO SECONDS DRIFT. Measured per frame with signalstats:

         t=0.0   YLOW 25  YHIGH 130  range 105  SATAVG 28.6  YAVG 68.3
         t=2.0   YLOW 29  YHIGH 129  range 100  SATAVG 25.6  YAVG 70.5
         t=6.0   YLOW 29  YHIGH 128  range  99  SATAVG 24.7  YAVG 70.9

      Contrast falls 6% and saturation falls 14%, both settling by
      about two seconds and then holding flat. On a single play you
      would never notice. On a loop you snap from the settled look back
      to the punchy one every six seconds, which is what reads as the
      contrast being "high at the start".

   3. IT IS HAZY, and this is the one the numbers make undeniable. The
      whole clip lives between 25 and 130 out of 255. Black is grey and
      white is barely past middle. Nothing is wrong with the encode;
      the picture simply never uses the top half of its range.
   ================================================================== */

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve("public/new_hero_dark.mp4");
const OUT = resolve("public/new_hero_dark_loop.mp4");

/* Source facts, from ffprobe. Kept as constants because every number
   below is derived from them. */
const DURATION = 6.2;

/* How long the tail dissolves into the head.

   The jump is 6.33 luma spread over this many frames, so at 0.8s (24
   frames) it contributes 0.26 per frame — half an ordinary frame's
   worth of motion, which is under the threshold of being seen. Longer
   would be safer still, but every extra second of dissolve is a second
   of the clip showing a double exposure, and it comes out of the run
   time: the loop is DURATION - FADE long. */
const FADE = 0.8;

/* ---- 1. open the range out ------------------------------------------
   The haze fix, and the only part of this that is a taste call rather
   than a measurement. Matched by eye to a reference frame.

   BOTH CONTROL POINTS MOVE UP, and that is the whole character of it.
   0.114 is the measured black point (29/255) and it goes UP to 0.155,
   not down. My first pass took it down to 0.045 and that was the error:
   crushing the shadows is what "high contrast" means here, and it made
   the night sky inky and the unlit half of the frame dead. The
   reference has luminous, open shadows — the dark areas are lit purple,
   not black — so the shadows lift and the picture stays glowing.

   0.502 is the measured white point and goes to 0.565, which keeps the
   neon bright. Lifting the black alone would just re-flatten the image
   back to the haze that started all this; lifting both is what gives an
   open shadow AND a bright sign at the same time.

   Measured, black 28.4 -> 31.6 and white 129.0 -> 148.3, so range goes
   100.7 -> 116.7. The first pass was 126.4, which is the 8% of extra
   contrast that read as too much.

   The unsharp is there because opening the range makes the source's
   softness more obvious, not less; 0.5 is enough to bring back the
   roofline and the bridge without putting a halo on the blossom. It is
   detail, not contrast, and it is not what was too strong. */
const grade =
    `curves=all='0/0 0.114/0.155 0.502/0.565 1/1',` +
    `eq=saturation=1.06,` +
    `unsharp=5:5:0.5:5:5:0`;

/* ---- 2. flatten the drift ------------------------------------------
   THIS RUNS AFTER THE GRADE, and that ordering is the whole trick.

   I first put it before, correcting the drift measured on the source,
   and it only removed about a third of it. The reason is that `curves`
   works in RGB: expanding the tonal range expands chroma along with it,
   so it re-amplifies whatever residual the correction left behind, and
   the correction has to be fitted to the signal it is actually the last
   word on. Measured on the GRADED signal instead:

         t=0.0   range 129   SATAVG 34.22
         t=1.0   range 128   SATAVG 32.85
         t=2.0   range 126   SATAVG 31.65
         t=3.0   range 126   SATAVG 30.94
         t=6.0   range 125   SATAVG 30.54

   And the decay is not the exponential I assumed from the coarser
   source numbers. Saturation falls very nearly LINEARLY for about three
   seconds and then sits flat, which a clamped ramp fits to within one
   percent where an exponential was out by three.

   Both corrections pull DOWNWARD, toward the settled look rather than
   the opening one. That direction is deliberate twice over: the settled
   state is what most of the clip already looks like, and pushing
   saturation up on compressed footage amplifies chroma blocking in
   exactly the flat night sky where it shows most.

   THESE CONSTANTS BELONG TO THE GRADE ABOVE. Change the curve and they
   are all wrong, because they describe the drift of the signal AFTER it
   has been through that curve. Re-measure by running the grade alone
   into signalstats and reading the 15-frame means. Under the current
   curve those are:

         t=0.0   range 123.1   SATAVG 30.15
         t=1.0   range 119.2   SATAVG 28.47
         t=2.0   range 115.6   SATAVG 27.13
         t=3.0   range 115.0   SATAVG 26.69
         t=5.5   range 115.4   SATAVG 26.44   */
const SAT_SETTLED = 26.45;
/* Measured excess is 3.70, but eq's saturation is not quite linear in
   what signalstats reports, so removing the full figure overshoots and
   leaves the opening FLATTER than the body. The de-rating that landed
   on the previous grade was 0.74, and it holds here. */
const SAT_EXCESS = 2.75;
const SAT_RAMP = 3.0;

const CON_SETTLED = 114.5;
const CON_EXCESS = 8.6;
const CON_RAMP = 3.0;

/* eval=frame is not optional and not a detail.

   eq evaluates its expressions ONCE AT INIT by default. Without this,
   every expression above is computed at t=0 and held for the whole
   clip — a constant multiplier wearing the costume of a correction.
   It fails silently and it looks plausible: the footage is a little
   less saturated overall, so the diff looks like it did something.

   With eval=init the smoothed saturation ran 29.7 down to 26.5, an 11%
   monotonic fall. With eval=frame it holds between 30.3 and 31.0 with
   no trend at all, and what is left is the neon flickering in the
   scene, which is content and should stay. */
const drift =
    `eq=` +
    `contrast='${CON_SETTLED}/(${CON_SETTLED}+${CON_EXCESS}*max(0,1-t/${CON_RAMP}))'` +
    `:saturation='${SAT_SETTLED}/(${SAT_SETTLED}+${SAT_EXCESS}*max(0,1-t/${SAT_RAMP}))'` +
    `:eval=frame`;

/* ---- 3. close the loop ----------------------------------------------
   Hold back the first FADE seconds and dissolve them onto the tail. The
   result starts at source time FADE and ends fully dissolved into source
   time FADE, so the last frame and the first frame are the same picture
   and the loop has nothing left to jump across.

   The order matters: the drift correction has to run before the trim,
   because it is a function of the SOURCE timeline. Grading after the
   rearrangement would apply the opening's correction to whatever
   happened to land at the front.

   The source is opened TWICE rather than split once. A split feeds every
   frame to both branches and lets xfade decide when to read them, and
   xfade does not touch the head until it reaches the offset — so the
   graph sits on several seconds of raw 1080p while it waits. Decoding
   the file a second time costs a few seconds; buffering that did not
   fit in memory and cost fifteen minutes.

   The second input is cut to the head with -t before it is decoded, so
   it produces the 24 frames the dissolve needs and then ends. Both
   inputs run the drift correction on their own timeline, which is the
   right one in both cases: input 0 IS the source timeline, and input 1
   starts at source zero. */
const body = DURATION - FADE;
const offset = body - FADE;

const filter =
    `[0:v]${grade},${drift},trim=start=${FADE},setpts=PTS-STARTPTS[body];` +
    `[1:v]${grade},${drift},setpts=PTS-STARTPTS[head];` +
    `[body][head]xfade=transition=fade:duration=${FADE}:offset=${offset}[v]`;

if (!existsSync(SRC)) {
    console.error(`missing source: ${SRC}`);
    process.exit(1);
}

console.log(`grading and closing the loop — ${DURATION}s in, ${body}s out`);

execFileSync(
    "ffmpeg",
    [
        "-v", "error", "-stats", "-y",
        "-i", SRC,
        /* The head, and only the head. -t before -i so the decoder stops
           after FADE seconds instead of reading the whole file again. */
        "-t", String(FADE), "-i", SRC,
        "-filter_complex", filter,
        "-map", "[v]",
        /* No audio in the source, and none wanted: a muted track is
           bytes that exist only to be ignored. */
        "-an",
        "-c:v", "libx264",
        /* medium, not slower. Preset trades encode time for size at a
           given quality, and CRF is what fixes the quality — slower buys
           a few percent of file size for many minutes of wall clock on a
           clip this short. Not a trade worth making. */
        "-preset", "medium",
        /* Constant quality, so the re-encode does not reintroduce the
           within-GOP decay the source already has. */
        "-crf", "20",
        /* Two-second keyframes. The browser never seeks this clip, so
           this is purely about capping how far quality can drift from
           any given intra frame. */
        "-g", "60",
        "-pix_fmt", "yuv420p",
        /* Playback can start on the first chunk instead of the last. */
        "-movflags", "+faststart",
        OUT,
    ],
    { stdio: "inherit" },
);

const mb = (statSync(OUT).size / 1048576).toFixed(2);
const was = (statSync(SRC).size / 1048576).toFixed(2);
console.log(`wrote ${OUT}  ${mb} MB (source ${was} MB)`);
