/* ==================================================================
   NISHIKI-E RENDER

   Turns the site's footage into colour woodblock prints: flat pigment
   areas, a fine sumi keyline, paper tooth underneath. One render serves
   both themes, because a print is pigment on paper and paper is still
   paper at night; the theme changes the ground the print is mounted on,
   not the print.

   Run:  node scripts/nishiki.mjs --proto     six frames, for approval
         node scripts/nishiki.mjs             everything
         node scripts/nishiki.mjs --only hero
         node scripts/nishiki.mjs --frames 1,80,145
         node scripts/nishiki.mjs --force

   THE APPROVAL GATE. A full pass is 287 frames at two sizes and takes
   a while, and the two things most likely to be wrong (the hoodie's
   indigo, the coffee's warmth) are visible in three frames each. So the
   full render refuses to start until _proto/APPROVED exists. Look at
   the prototypes, then create that file.

   WHY A FIXED PALETTE. `elbg` posterises beautifully but rebuilds its
   codebook per frame, so a pigment boundary lands in a slightly
   different place each time and the whole image crawls under a scrub.
   `paletteuse` against one palette we author is deterministic: frame
   80 and frame 81 quantise the same way, so the print holds still.
   ================================================================== */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public");
const OUT = path.join(ROOT, "nishiki");
const PROTO = path.join(OUT, "_proto");
const ASSETS = path.join(process.cwd(), "scripts", "assets");
const INCOMING = path.join(ROOT, "_incoming");
const APPROVED = path.join(PROTO, "APPROVED");

/* ---- pigments --------------------------------------------------------
   The palettes a block-cutter would have had. Each set is written to a
   1-pixel-tall PNG and handed to `paletteuse`, so these lists ARE the
   colours in the finished frames: nothing else can appear.

   Kept deliberately short. A 64-colour palette reproduces the photograph
   and the result is a filtered video; sixteen forces the flattening that
   makes it read as something that was printed. */
const PIGMENTS = {
    /* The hero: a person in a grey hoodie, lit against a black studio.
       The greys are graded toward indigo before quantising, so the hoodie
       lands on the `ai` steps while skin stays on the warm ones. */
    figure: [
        "231f1d", "3a2f2a", "6b4a2f", "8a5f4a",
        "b98a6d", "ddb694", "f0d9bf", "eadfc6",
        "16293f", "1f3a5f", "345a86", "5b7fa8",
        "5c6470", "9aa3ad", "b07a2a", "f1eadb",
    ],
    /* The espresso pour: ochre and umber for the coffee, steel for the
       machine, one safflower red so the crema has somewhere warm to go. */
    coffee: [
        "231f1d", "3d2a1c", "5a3d26", "74502e",
        "8f6224", "b07a2a", "c99a5c", "ddb984",
        "ecd9b4", "eadfc6", "f1eadb", "fdf6e8",
        "3a4048", "6b7078", "9aa0a8", "b8323f",
    ],
    /* The wave. Hokusai's palette, plus the three golds its own leaf ground
       needs so that the video's gold and the site's gold become the same
       gold: snapping both to these is what stops the painting reading as a
       picture pasted onto a panel rather than painted on one. */
    wave: [
        "1a1a1a", "2a2622", "1b3a5c", "2c5580",
        "4a7fb0", "7aa8ce", "a8c6de", "d5e3ee",
        "f2f0e6", "fdfbf4", "6b4a2f", "a08a5e",
        "6b7a88", "8a6a22", "c9a24a", "e4c87b",
    ],
    /* The inkstone. Mostly a greyscale, which is what grinding ink is, with
       the sleeve's indigo, a little skin, and the same three golds. */
    ink: [
        "141414", "232323", "3a3a3c", "5a5a5e",
        "7d7d82", "9fa0a5", "c4c5c9", "f2f0e6",
        "1e2438", "2c3450", "b98a6d", "ddb694",
        "f0d9bf", "8a6a22", "c9a24a", "e4c87b",
    ],
    /* Project artwork is synthetic and already saturated, so it gets the
       full spread of the site's pigments rather than a scene-specific set. */
    art: [
        "231f1d", "3a4048", "5c6470", "8d959f",
        "1f3a5f", "345a86", "2f5ba3", "5b7fa8",
        "3f7d6a", "6fa38f", "b07a2a", "ddb984",
        "c9412a", "eadfc6", "f1eadb", "fdf6e8",
    ],
};

/* ---- filter fragments ------------------------------------------------ */

/* Dyes the hoodie indigo and leaves the person alone.

   Measured on the source: the hoodie is colourless (333234 at the chest,
   201f1f at the shoulder, blue equal to or above red) while skin, hair and
   hands are warm (614b41 on the face, red above blue by 32). So "warmth",
   red minus blue, separates cloth from person cleanly, and this is a rule on
   that one number rather than a global colour cast.

   `selectivecolor=neutrals` was the obvious tool and it is the wrong one: the
   whole frame is a dark, low-saturation studio shot, so nearly every pixel
   reads as neutral to it and the face turns blue along with the cloth.

   `k` ramps from 0 at warmth 14 to 1 at warmth 0, so the dye fades in over
   the boundary instead of cutting at it, which would band along the jaw. The
   additive term on blue exists because the darkest folds are so near black
   that multiplying them by anything leaves them near black. */
const WARMTH = "(r(X,Y)-b(X,Y))";
const K = `clip((14-${WARMTH})/14,0,1)`;
const DYE_INDIGO =
    `geq=` +
    `r='r(X,Y)*(1-0.46*${K})':` +
    `g='g(X,Y)*(1-0.12*${K})':` +
    `b='min(255, b(X,Y)*(1+0.95*${K}) + 30*${K})'`;

/** The keyline. Canny edges, inverted, so it multiplies as black on white. */
const KEYLINE = (blur, lo, hi) =>
    `gblur=sigma=${blur},edgedetect=low=${lo}:high=${hi},negate,format=gray`;

/**
 * Isolates a figure lit against a black studio by flooding IN from all four
 * corners rather than thresholding luminance.
 *
 * A threshold cannot do this: the darkest folds of a black hoodie are darker
 * than the lit parts of the studio floor, so any cutoff that removes the
 * background also punches holes through the subject. A flood fill asks a
 * different question, "what is connected to the edge of the frame", and the
 * subject is not, so it survives whole.
 */
const KEY = (w, h, ground = "dark", corners = "all") => {
    /* Step one marks anything that is not ground. On a black studio that is
       "brighter than almost nothing"; on a white page it is the inverse. */
    const mark = ground === "light" ? "if(lt(val,250),255,0)" : "if(gt(val,5),255,0)";

    /* Which corners to flood from. The portrait drawing runs off the bottom of
       its page, so its lower corners are the subject, not the ground, and
       flooding from them would eat the figure from the shoulders up. */
    const pts =
        corners === "top"
            ? [[0, 0], [w - 1, 0]]
            : [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];

    return (
        `format=gray,lut='${mark}',` +
        pts.map(([x, y]) => `floodfill=x=${x}:y=${y}:s0=0:d0=128`).join(",") +
        /* Anything the flood reached was connected to the frame edge, so it is
           ground. Everything else, including white pockets inside the figure,
           stays opaque, which is the whole reason for flooding rather than
           thresholding. */
        `,lut='if(eq(val,128),0,255)',erosion,dilation,gblur=sigma=1.2,format=gray`
    );
};

/**
 * The print graph.
 *
 * Order matters. Grade, then flatten to pigments, then lay the keyline over
 * the flat colour, then the paper under everything. Flattening after the
 * keyline would quantise the line itself into a pigment step and it would
 * break up; laying paper before the keyline would print the line on the
 * fibre rather than the fibre showing through the ink.
 *
 * @param key   remove a black studio ground, leaving the figure on alpha
 * @param sm    also emit a downscaled copy from the finished render, so the
 *              phone set is a resample of the print and not a fresh render
 *              at lower resolution where the edge detector would draw a
 *              proportionally heavier line
 */
function printGraph({ w, h, key, ground, corners, sm, tint, edge, grade }) {
    const parts = [];
    const copies = 1 + (edge ? 1 : 0) + (key ? 1 : 0);
    parts.push(
        `[0:v]scale=${w}:${h}:flags=lanczos` +
        (copies > 1 ? `,split=${copies}[a]${edge ? "[c]" : ""}${key ? "[k]" : ""}` : "[a]"),
    );
    parts.push(
        `[a]${tint ? DYE_INDIGO + "," : ""}eq=${grade},gblur=sigma=0.8[grade]`,
    );
    /* EVERY input to a blend is forced to planar gbrp, and that is not
       tidiness. Handed packed rgb24, ffmpeg's blend filter reads the three
       channels in the wrong order: a warm brown 95764b comes back as 23b50a,
       a bright green, and the whole sequence prints in the wrong hue. Handed
       gbrp it is exact. The conversion back to packed happens once, at the end.

       The same care applies to `paletteuse`, which emits pal8: left to
       negotiate against a gray keyline, ffmpeg settles on gray and quietly
       throws the pigments away. */
    parts.push(`[grade][1:v]paletteuse=dither=none:diff_mode=rectangle,format=gbrp[flat]`);
    /* The keyline is optional now.

       Footage of a real scene has no outlines, so one is detected and drawn.
       Artwork that arrived already drawn has its own, and detecting a second
       set on top of them doubles every edge into a smeared band. Sources that
       come in as flat illustration pass `edge: null` and skip this. */
    let lined = "flat";
    if (edge) {
        parts.push(`[c]${KEYLINE(edge.blur, edge.lo, edge.hi)},format=gbrp[edges]`);
        parts.push(`[flat][edges]blend=all_mode=multiply[lined]`);
        lined = "lined";
    }
    /* The tooth tile is stretched rather than repeated: ffmpeg tiles frames,
       not space, and at this scale a soft fibre reads better than a hard one
       anyway. It is a 28% multiply, so it tints rather than textures. */
    parts.push(`[2:v]scale=${w}:${h}:flags=bicubic,format=gray,format=gbrp[tooth]`);
    parts.push(`[${lined}][tooth]blend=all_mode=multiply:all_opacity=0.28[print]`);

    let last = "print";
    if (key) {
        parts.push(`[print]format=rgba[printa]`);
        parts.push(`[k]${KEY(w, h, ground, corners)}[mask]`);
        parts.push(`[printa][mask]alphamerge,format=rgba[keyed]`);
        last = "keyed";
    } else {
        parts.push(`[print]format=rgb24[flatout]`);
        last = "flatout";
    }

    const maps = [];
    if (sm) {
        parts.push(`[${last}]split=2[lg][tmp]`);
        parts.push(`[tmp]scale=${sm.w}:${sm.h}:flags=lanczos[smo]`);
        maps.push("[lg]", "[smo]");
    } else {
        maps.push(`[${last}]`);
    }
    return { graph: parts.join(";"), maps };
}

/* ---- sources --------------------------------------------------------- */

const pad = (i) => String(i).padStart(3, "0");

/* A source that is a video rather than a folder of stills.

   `count` frames are taken at even spacing across the whole clip, so the
   scrub covers the entire action regardless of how long the clip is or what
   frame rate it was exported at. The seek is computed per frame and handed
   to ffmpeg before -i, and the print graph is otherwise identical: a video is
   just a different way of arriving at a frame. */
const VIDEO = (file, count, duration) => ({
    video: path.join(INCOMING, file),
    count,
    /* Stop well short of the stated duration.

       Measured on both supplied clips: the ink one turns to a white card
       somewhere after 7.92 of its 8.03 seconds, and the wave one returns no
       frame at all at 7.98 of 8.00. Generated video routinely carries a tail
       like that, and since the last frame here is the one the hero HOLDS on
       while the introduction is read, landing on it would leave a white
       rectangle under the closing text. A sixth of a second of margin costs
       nothing and removes the whole class of problem. */
    seekFor: (i) => ((i - 1) / (count - 1)) * (duration - 0.15),
});

const SOURCES = {
    /* The avatar. It plays in About now, not the hero: a person turning to
       camera is a portrait, and a byōbu carries a painting. The source folder
       keeps its old name because that is what the footage was called. */
    about: {
        count: 145,
        w: 2560, h: 1440,
        sm: { w: 1280, h: 720 },
        key: true,
        tint: true,
        pigments: "figure",
        /* The studio is dark: the face measures 614b41, well below the skin
           steps in the palette. Lifted and warmed before quantising so it
           lands on flesh rather than on umber. */
        grade: "contrast=1.16:brightness=0.05:saturation=1.35",
        edge: { blur: 1.2, lo: 0.05, hi: 0.16 },
        alpha: true,
        src: (i) => path.join(ROOT, "hero-motion", `frame-${pad(i)}.webp`),
        out: (i, small) =>
            path.join(OUT, "about", small ? "sm" : "", `frame-${pad(i)}.webp`),
        proto: [1, 80, 145],
    },
    /* The wave, painted across the whole screen. Its own gold leaf ground is
       snapped to the site's three golds by the palette, so the painting and
       the panels it is painted on are made of the same metal.

       No keyline detected: the artwork arrived with its own outlines, and a
       second pass over them doubles every edge. */
    hero: {
        ...VIDEO("hero-wave.mp4", 145, 8.0),
        w: 1920, h: 1080,
        sm: { w: 960, h: 540 },
        key: false,
        tint: false,
        pigments: "wave",
        /* Barely touched. It is already flat, already graded, and already the
           right colours; all this does is firm the blues a little before they
           are snapped to the palette. */
        grade: "contrast=1.04:saturation=1.06",
        edge: null,
        alpha: false,
        out: (i, small) =>
            path.join(OUT, "hero", small ? "sm" : "", `frame-${pad(i)}.webp`),
        proto: [1, 60, 110, 145],
    },
    contact: {
        ...VIDEO("contact-ink.mp4", 142, 8.0),
        w: 1920, h: 1080,
        sm: { w: 960, h: 540 },
        key: false,
        tint: false,
        pigments: "ink",
        grade: "contrast=1.04:saturation=1.02",
        edge: null,
        alpha: false,
        out: (i, small) =>
            path.join(OUT, "contact", small ? "sm" : "", `frame-${pad(i)}.webp`),
        proto: [1, 50, 100, 142],
    },
};

const IMAGES = [
    ...["murmur", "bail", "bu", "kine"].map((id) => ({
        id,
        src: path.join(ROOT, "projects", `${id}.webp`),
        out: path.join(OUT, "projects", `${id}.webp`),
        pigments: "art",
        grade: "contrast=1.06:saturation=1.15",
        key: false, tint: false, alpha: false,
        edge: { blur: 1.0, lo: 0.06, hi: 0.18 },
    })),
    {
        id: "portrait",
        src: path.join(ROOT, "light.png"),
        out: path.join(OUT, "portrait.webp"),
        pigments: "figure",
        grade: "contrast=1.1:saturation=1.2",
        /* A drawing on a white page, so the same corner flood lifts it off
           that page the way the studio black is lifted off the hero, with the
           threshold inverted. Only the top corners are flooded: the figure
           runs off the bottom edge, so the lower corners are subject.

           Keyed and alpha, because in About the portrait stands on a gold
           panel and a white rectangle behind it would read as a sticker. */
        key: true, ground: "light", corners: "top", tint: false, alpha: true,
        edge: { blur: 0.9, lo: 0.06, hi: 0.2 },
    },
];

/* ---- plumbing -------------------------------------------------------- */

function run(cmd, args) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        let err = "";
        p.stdout.on("data", (d) => (out += d));
        p.stderr.on("data", (d) => (err += d));
        p.on("close", (code) =>
            code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}\n${err}`)),
        );
    });
}

const ensureDir = (file) => mkdir(path.dirname(file), { recursive: true });

/**
 * Writes a palette to a 16x16 PNG.
 *
 * `paletteuse` requires its palette input to be exactly 256 pixels, so the
 * pigments are laid out as 8px blocks, stacked into a strip, then resampled
 * with nearest-neighbour down to 16 columns and up to 16 rows. Every column
 * is one pigment and every row is identical, which gives 256 pixels holding
 * exactly the intended set. Blocks are 8px rather than 1px only because this
 * ffmpeg build refuses to open a 1x1 source.
 */
async function palettePng(name) {
    const file = path.join(ASSETS, `palette-${name}.png`);
    if (existsSync(file)) return file;
    await ensureDir(file);
    const cols = PIGMENTS[name];
    const args = ["-v", "error", "-y"];
    for (const c of cols) args.push("-f", "lavfi", "-i", `color=c=0x${c}:s=8x8`);
    args.push(
        "-filter_complex",
        `${cols.map((_, i) => `[${i}:v]`).join("")}hstack=inputs=${cols.length},` +
        `scale=16:16:flags=neighbor,format=rgb24`,
        "-frames:v", "1", file,
    );
    await run("ffmpeg", args);
    return file;
}

const enc = (alpha) =>
    alpha
        ? ["-c:v", "libwebp", "-quality", "84", "-compression_level", "6", "-pix_fmt", "yuva420p"]
        : ["-c:v", "libwebp", "-quality", "84", "-compression_level", "6"];

async function render({ src, seek, w, h, key, ground, corners, sm, tint, edge, grade, alpha, palette, outs }) {
    const { graph, maps } = printGraph({ w, h, key, ground, corners, sm, tint, edge, grade });
    const args = [
        "-v", "error", "-y",
        /* Before -i, so it is a keyframe seek rather than a decode of every
           frame up to that point. On an 8 second clip the difference between
           the two is the difference between a render that takes a minute and
           one that takes twenty. */
        ...(seek === undefined ? [] : ["-ss", seek.toFixed(4)]),
        "-i", src,
        "-i", palette,
        "-i", path.join(ASSETS, "washi-tooth.png"),
        "-filter_complex", graph,
    ];
    maps.forEach((m, i) => args.push("-map", m, "-frames:v", "1", ...enc(alpha), outs[i]));
    await Promise.all(outs.map(ensureDir));
    await run("ffmpeg", args);
}

async function pool(tasks, size) {
    let next = 0;
    let done = 0;
    const total = tasks.length;
    const started = Date.now();
    const worker = async () => {
        while (next < total) {
            await tasks[next++]();
            done++;
            if (done % 25 === 0 || done === total) {
                const s = ((Date.now() - started) / 1000).toFixed(0);
                process.stdout.write(`  ${done}/${total}  (${s}s)\n`);
            }
        }
    };
    await Promise.all(Array.from({ length: size }, worker));
}

/* ---- main ------------------------------------------------------------ */

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
};

const isProto = flag("proto");
const only = opt("only");
const limit = opt("limit") ? Number(opt("limit")) : Infinity;
const frames = opt("frames") ? new Set(opt("frames").split(",").map(Number)) : null;
const force = flag("force");

if (!existsSync(path.join(ASSETS, "washi-tooth.png"))) {
    console.error("missing scripts/assets/washi-tooth.png — run: node scripts/textures.mjs washi");
    process.exit(1);
}

if (!isProto && !existsSync(APPROVED)) {
    console.error(
        `\nThe prototypes have not been approved.\n\n` +
        `  1. node scripts/nishiki.mjs --proto\n` +
        `  2. look at ${path.relative(process.cwd(), PROTO)}\n` +
        `  3. create ${path.relative(process.cwd(), APPROVED)} to unlock the full render\n`,
    );
    process.exit(1);
}

const palettes = {};
for (const name of Object.keys(PIGMENTS)) palettes[name] = await palettePng(name);

const tasks = [];

for (const [id, s] of Object.entries(SOURCES)) {
    if (only && only !== id) continue;
    const first = s.video ?? s.src(1);
    if (!existsSync(first)) {
        console.error(`skip ${id}: ${first} not found`);
        continue;
    }
    const wanted = isProto ? s.proto : null;
    const n = Math.min(s.count, limit);
    for (let i = 1; i <= n; i++) {
        if (wanted && !wanted.includes(i)) continue;
        if (frames && !frames.has(i)) continue;
        const outs = isProto
            ? [path.join(PROTO, `${id}-${pad(i)}.webp`)]
            : [s.out(i, false), s.out(i, true)];
        if (!force && outs.every((f) => existsSync(f))) continue;
        tasks.push(() =>
            render({
                src: s.video ?? s.src(i),
                seek: s.seekFor?.(i),
                w: s.w, h: s.h, key: s.key, ground: s.ground, corners: s.corners,
                sm: isProto ? null : s.sm,
                tint: s.tint, edge: s.edge, grade: s.grade, alpha: s.alpha,
                palette: palettes[s.pigments], outs,
            }),
        );
    }
}

if (!isProto) {
    for (const img of IMAGES) {
        if (only && only !== "images") continue;
        if (!existsSync(img.src)) {
            console.error(`skip ${img.id}: ${img.src} not found`);
            continue;
        }
        if (!force && existsSync(img.out)) continue;
        tasks.push(async () => {
            const { w, h } = await probe(img.src);
            await render({
                src: img.src, w, h, key: img.key, ground: img.ground, corners: img.corners, sm: null,
                tint: img.tint, edge: img.edge, grade: img.grade, alpha: img.alpha,
                palette: palettes[img.pigments], outs: [img.out],
            });
        });
    }
}

async function probe(file) {
    const out = await run("ffprobe", [
        "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "csv=p=0", file,
    ]);
    const [w, h] = out.trim().split(",").map(Number);
    return { w, h };
}

if (!tasks.length) {
    console.log("nothing to do (use --force to re-render)");
} else {
    console.log(`${isProto ? "prototype" : "render"}: ${tasks.length} frames`);
    await pool(tasks, Math.max(2, Math.min(6, cpus().length - 1)));
    if (isProto) {
        await writeFile(
            path.join(PROTO, "README.txt"),
            "Prototype frames for approval.\n" +
            "If the pigments are right, create a file named APPROVED in this\n" +
            "directory and run: node scripts/nishiki.mjs\n",
        );
        console.log(`\nwrote ${path.relative(process.cwd(), PROTO)}`);
    }
}
