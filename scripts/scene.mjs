/* ==================================================================
   SCENE RENDER

   Turns the supplied 3D footage into the frame sequences and backdrops
   the site scrubs through. Two worlds, one per theme: a mountain path
   in the morning, and Tokyo back streets at night.

   Run:  node scripts/scene.mjs --proto     a few frames, for approval
         node scripts/scene.mjs             everything
         node scripts/scene.mjs --only hero-light
         node scripts/scene.mjs --force

   WHY THIS IS NOT scripts/nishiki.mjs. That script makes woodblock
   prints: it flattens every frame to sixteen fixed pigments, draws a
   keyline and multiplies paper over it. That is the correct treatment
   for a print and the exactly wrong one for 3D, because the first thing
   it throws away is the tonal gradation that reads as depth. Running
   this footage through it would undo the entire reason for shooting it.

   So the treatment here is almost nothing: resize, a light grade to
   hold each world's colour together, sharpen for the downscale, encode.
   The footage arrived good. The job is to not spoil it.

   nishiki.mjs stays, and still renders the avatar, which is still a
   print of a person rather than a place.
   ================================================================== */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public");
const IN = path.join(ROOT, "_incoming");
const OUT = path.join(ROOT, "scene");
const PROTO = path.join(OUT, "_proto");

/* ---- shape ------------------------------------------------------------
   96 frames on a 500vh track is 5.2vh of scroll each, which at a 900px
   viewport is 47 pixels per frame: the same feel the old 145-frame
   sequences had on their taller tracks.

   Both numbers came down together on purpose. Two worlds means two of
   every sequence, so halving the frames pays for the second world, and
   shortening the track stops the page becoming enormous now that there
   are five scroll-driven sections rather than two. */
export const FRAMES = 96;

/* 1440 rather than the source's 1920, and that is measured rather than
   guessed. The widest band the site draws is the viewport, so a 1440px
   window resolves exactly this and nothing more; the extra 480 source
   columns are invisible on anything but a 4K desktop.

   It matters most in the rainy world. Rain and neon are almost pure
   high-frequency detail, which is the worst case for any compressor: the
   dark contact frames came out at 156 KB against the mountain's 113, and
   at 96 frames that difference alone is 4 MB. */
const LG = { w: 1440, h: 810 };
const SM = { w: 960, h: 540 };

/* ---- the two worlds ---------------------------------------------------
   The grade is deliberately tiny. Both worlds arrived already lit and
   already graded by whatever rendered them; all this does is pull the
   two of them toward a common contrast so that flipping the theme
   mid-scroll does not also flip the exposure. */
const GRADE = {
    /* The mountain: morning haze wants a hair more contrast or it reads
       flat, and a touch of warmth in the lift. */
    light: "eq=contrast=1.05:saturation=1.04:brightness=0.008",
    /* The city: rain and neon are already high contrast, so this only
       deepens the wet blacks a little and holds the neon back from
       clipping. */
    dark: "eq=contrast=1.04:saturation=1.02:brightness=-0.006",
    /* The blade sits in near darkness and is mostly one specular
       highlight. Left almost alone; crushing it would lose the hamon. */
    blade: "eq=contrast=1.02:saturation=0.98",
};

/**
 * Lifts a figure off the black studio he was shot against, by flooding IN
 * from all four corners rather than thresholding luminance.
 *
 * A threshold cannot do this: the darkest folds of a dark hoodie are darker
 * than the lit parts of the studio floor, so any cutoff that removes the
 * background also punches holes through the subject. A flood fill asks a
 * different question, "what is connected to the edge of the frame", and the
 * subject is not, so it survives whole.
 */
const KEY = (w, h) =>
    `format=gray,lut='if(gt(val,5),255,0)',` +
    `floodfill=x=0:y=0:s0=0:d0=128,floodfill=x=${w - 1}:y=0:s0=0:d0=128,` +
    `floodfill=x=0:y=${h - 1}:s0=0:d0=128,floodfill=x=${w - 1}:y=${h - 1}:s0=0:d0=128,` +
    `lut='if(eq(val,128),0,255)',erosion,dilation,gblur=sigma=1.4,format=gray`;

/**
 * The whole treatment, per frame.
 *
 * `unsharp` is applied AFTER the downscale rather than before, which is the
 * only ordering that helps: sharpening then shrinking throws the sharpening
 * away, and shrinking then sharpening restores the edge the resample softened.
 * The small set gets a touch more of it because it is resampled further.
 */
function graph({ grade, sm, key, crop, size = LG }) {
    const parts = [];
    /* Keyed sources carry alpha and must stay packed RGBA to the end: a
       yuv420p pass anywhere in the chain silently drops the alpha plane and
       the figure comes back on a black rectangle. */
    const fmt = key ? "rgba" : "yuv420p";

    if (key) {
        /* Crop first, then scale. The avatar was shot 16:9 and is shown in a
           3:4 portrait box, so scaling straight to the target stretches him
           vertically by more than two to one. He is centred in frame and fills
           its height, so a centred crop to the target aspect loses only empty
           studio either side. */
        const cropped = crop ? `crop=${crop},` : "";
        parts.push(`[0:v]${cropped}scale=${size.w}:${size.h}:flags=lanczos,split=2[a][k]`);
        parts.push(`[a]${grade},unsharp=5:5:0.42:5:5:0.0,format=rgba[body]`);
        parts.push(`[k]${KEY(size.w, size.h)}[mask]`);
        parts.push(`[body][mask]alphamerge,format=rgba${sm ? ",split=2[lg][t]" : "[lg]"}`);
    } else {
        parts.push(
            `[0:v]${grade},scale=${size.w}:${size.h}:flags=lanczos,` +
            `unsharp=5:5:0.42:5:5:0.0,format=${fmt}${sm ? ",split=2[lg][t]" : "[lg]"}`,
        );
    }
    if (sm) {
        parts.push(
            `[t]scale=${SM.w}:${SM.h}:flags=lanczos,unsharp=5:5:0.55:5:5:0.0` +
            `${key ? ",format=rgba" : ""}[sm]`,
        );
    }
    return { graph: parts.join(";"), maps: sm ? ["[lg]", "[sm]"] : ["[lg]"] };
}

/* ---- sources ---------------------------------------------------------- */

const pad = (i) => String(i).padStart(3, "0");

/** A clip, sampled at `FRAMES` evenly spaced points across its usable length. */
const clip = (file, world, dir, opts = {}) => ({
    kind: "video",
    src: path.join(IN, file),
    grade: GRADE[opts.grade ?? world],
    count: opts.count ?? FRAMES,
    sm: opts.sm !== false,
    /* Stop short of the stated duration. Generated clips routinely carry a
       dead tail: on the earlier batch one ended on a white card and another
       returned no frame at all inside the last tenth of a second. The last
       frame here is the one a section HOLDS on, so landing on a bad one is
       the most visible possible failure for the least possible reason. */
    seekFor: (i, n) => ((i - 1) / (n - 1)) * ((opts.duration ?? 8.0) - 0.2),
    out: (i, small) => path.join(OUT, dir, small ? "sm" : "", `frame-${pad(i)}.webp`),
});

/**
 * A sequence that already exists as numbered stills rather than as a clip.
 *
 * The avatar was shot as frames long before any of this, and it is the one
 * subject in the site that is a person rather than a place. It is keyed off
 * its studio black and graded per world, so he picks up the room's light
 * instead of carrying a different one into it.
 */
const frames = (dir, world, out, opts = {}) => ({
    kind: "frames",
    srcAt: (i) => path.join(ROOT, dir, `frame-${pad(i)}.webp`),
    grade: GRADE[world],
    key: true,
    /* 1080x1440 out of a 2560x1440 source: the tallest 3:4 window the frame
       can give, centred on a figure who is already centred in it. */
    crop: opts.crop ?? "1080:1440:740:0",
    size: opts.size ?? { w: 900, h: 1200 },
    count: opts.count ?? 72,
    sm: false,
    /* Evenly spaced across the source, which has more frames than we want. */
    pick: (i, n) => 1 + Math.round(((i - 1) / (n - 1)) * ((opts.of ?? 145) - 1)),
    out: (i) => path.join(OUT, out, `frame-${pad(i)}.webp`),
});

/** A backdrop the camera pans and pushes across rather than scrubs. */
const still = (file, world, name) => ({
    kind: "image",
    src: path.join(IN, file),
    grade: GRADE[world],
    count: 1,
    sm: true,
    out: (_i, small) => path.join(OUT, "backdrop", small ? "sm" : "", `${name}.webp`),
});

const SOURCES = {
    /* The loading screen. One clip for both worlds: a blade in the dark is
       the same blade whatever the weather outside. */
    katana: clip("katana-draw.mp4", "light", "katana", { grade: "blade", count: 64, sm: false }),

    "hero-light": clip("hero-light.mp4", "light", "hero/light"),
    "hero-dark": clip("hero-dark.mp4", "dark", "hero/dark"),
    /* 72 rather than 96. The contact move is an approach that slows to a
       stop, which is far less travel per second than the hero's push, so it
       survives a coarser sampling. It also happens to be the heaviest footage
       in the site to compress, so this is where a frame is worth most. */
    "contact-light": clip("contact-light.mp4", "light", "contact/light", { count: 72 }),
    "contact-dark": clip("contact-dark.mp4", "dark", "contact/dark", { count: 72 }),

    /* The figure, once per world. Two grades of the same performance: the
       dojo is warm and side-lit, the apartment is cool and lamp-lit, and a
       single grade would put a person carrying the wrong light into one of
       the two rooms. Portrait-shaped, because he is standing. */
    "avatar-light": frames("hero-motion", "light", "avatar/light"),
    "avatar-dark": frames("hero-motion", "dark", "avatar/dark"),

    "about-light": still("about-light.png", "light", "about-light"),
    "about-dark": still("about-dark.png", "dark", "about-dark"),
    "projects-light": still("projects-light.png", "light", "projects-light"),
    "projects-dark": still("projects-dark.png", "dark", "projects-dark"),
    "footer-light": still("footer-light.png", "light", "footer-light"),
    "footer-dark": still("footer-dark.png", "dark", "footer-dark"),

    /* The four project artworks, graded and nothing more. They are the work
       itself, so they are the one thing in the site that must not be restyled
       to match a world: they are shown, not set. */
    ...Object.fromEntries(
        ["murmur", "bail", "bu", "kine"].map((id) => [
            `project-${id}`,
            {
                kind: "image",
                src: path.join(ROOT, "projects", `${id}.webp`),
                grade: "eq=contrast=1.02:saturation=1.02",
                count: 1,
                sm: true,
                out: (_i, small) =>
                    path.join(OUT, "projects", small ? "sm" : "", `${id}.webp`),
            },
        ]),
    ),
};

/* ---- plumbing --------------------------------------------------------- */

function run(cmd, args) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        let err = "";
        p.stdout.on("data", (d) => (out += d));
        p.stderr.on("data", (d) => (err += d));
        p.on("close", (c) =>
            c === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${c}\n${err}`)),
        );
    });
}

const ensureDir = (f) => mkdir(path.dirname(f), { recursive: true });

/* q80 rather than the print pipeline's 84. A flat print holds its edges under
   compression because it has almost none; a rainy neon alley is nothing but
   fine detail, and the extra points buy far less than they cost. */
const ENC = ["-c:v", "libwebp", "-quality", "78", "-compression_level", "6"];
/* Alpha survives only in yuva420p; the default drops it and the figure comes
   back on a black rectangle in the middle of the room. */
const ENC_A = [...ENC, "-pix_fmt", "yuva420p"];

async function render(s, i, outs) {
    const { graph: g, maps } = graph({ grade: s.grade, sm: s.sm, key: s.key, crop: s.crop, size: s.size });
    const args = ["-v", "error", "-y"];
    if (s.kind === "video") {
        /* Before -i so it is a keyframe seek. After -i, ffmpeg decodes every
           frame from the start of the clip to the target, and a 96-frame pass
           becomes minutes of redundant decoding. */
        args.push("-ss", s.seekFor(i, s.count).toFixed(4));
    }
    args.push("-i", s.kind === "frames" ? s.srcAt(s.pick(i, s.count)) : s.src, "-filter_complex", g);
    const enc = s.key ? ENC_A : ENC;
    maps.forEach((m, k) => args.push("-map", m, "-frames:v", "1", ...enc, outs[k]));
    await Promise.all(outs.map(ensureDir));
    await run("ffmpeg", args);
}

async function pool(tasks, size) {
    let next = 0;
    let done = 0;
    const started = Date.now();
    const worker = async () => {
        while (next < tasks.length) {
            await tasks[next++]();
            done++;
            if (done % 25 === 0 || done === tasks.length) {
                const s = ((Date.now() - started) / 1000).toFixed(0);
                process.stdout.write(`  ${done}/${tasks.length}  (${s}s)\n`);
            }
        }
    };
    await Promise.all(Array.from({ length: size }, worker));
}

/* ---- main ------------------------------------------------------------- */

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
};

const isProto = flag("proto");
const only = opt("only");
const force = flag("force");

const tasks = [];
for (const [id, s] of Object.entries(SOURCES)) {
    if (only && only !== id) continue;
    const probe = s.kind === "frames" ? s.srcAt(1) : s.src;
    if (!existsSync(probe)) {
        console.error(`skip ${id}: ${path.relative(process.cwd(), probe)} not found`);
        continue;
    }

    /* Four frames is enough to judge a camera move: where it starts, two
       points along the way, and the frame it will come to rest on. */
    const wanted = isProto
        ? (s.count === 1 ? [1] : [1, Math.round(s.count * 0.4), Math.round(s.count * 0.75), s.count])
        : Array.from({ length: s.count }, (_, k) => k + 1);

    for (const i of wanted) {
        const outs = isProto
            ? [path.join(PROTO, `${id}-${pad(i)}.webp`)]
            : [s.out(i, false), ...(s.sm ? [s.out(i, true)] : [])];
        if (!force && outs.every(existsSync)) continue;
        tasks.push(() => render({ ...s, sm: isProto ? false : s.sm }, i, outs));
    }
}

if (!tasks.length) {
    console.log("nothing to do (use --force to re-render)");
} else {
    console.log(`${isProto ? "prototype" : "render"}: ${tasks.length} frames`);
    await pool(tasks, Math.max(2, Math.min(6, cpus().length - 1)));
    if (isProto) {
        await writeFile(
            path.join(PROTO, "README.txt"),
            "Prototype frames. Check that each camera move starts, travels and\n" +
            "comes to rest where it should, then run: node scripts/scene.mjs\n",
        );
        console.log(`\nwrote ${path.relative(process.cwd(), PROTO)}`);
    }
}
