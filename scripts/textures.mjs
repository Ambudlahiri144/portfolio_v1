/* ==================================================================
   MATERIALS AND MARKS

   Renders every non-photographic asset the byōbu world is built from,
   offline, with ffmpeg. Nothing here is drawn by a generative model:
   gold leaf, lacquer and paper are procedural, and the seal is real
   katakana set in a real typeface.

   Run:  node scripts/textures.mjs            everything
         node scripts/textures.mjs gold       one target
         node scripts/textures.mjs --force    re-render existing files

   Targets: gold  sunago  washi  hanko

   WHY PROCEDURAL. A folding screen is made of four materials and
   nothing else: leaf, lacquer, paper, pigment. Three of them are
   regular structures with noise on top, which is exactly what a filter
   graph is good at, and rendering them here means they are seamless by
   construction, tunable by one number, and identical every build. The
   fourth, pigment, comes from the footage in scripts/nishiki.mjs.

   IF YOU SUPPLY ART. Drop ChatGPT renders into public/_incoming/ as
   gold-leaf.png and sunago.png and this script will mirror-tile and
   grade those instead of synthesising them. Everything downstream is
   unchanged; see readIncoming() below.
   ================================================================== */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public");
const OUT_BYOBU = path.join(ROOT, "byobu");
const OUT_BRAND = path.join(ROOT, "brand");
const OUT_ASSETS = path.join(process.cwd(), "scripts", "assets");
const INCOMING = path.join(ROOT, "_incoming");

/* ---- palette ---------------------------------------------------------
   These MUST equal the matching tokens in globals.css. The gold rendered
   here is the same gold the CSS `.goldFace` paints under its sheen and the
   same gold three.js lights, so a panel edge in WebGL meets a panel edge in
   CSS without a visible step. Change one, change all three. */
const GOLD_HI = "0xeed58a";
const GOLD_LO = "0x8a6a22";

/* The leaf sheet's own tonal range, deliberately narrower than --gold-lo to
   --gold-hi and centred on --gold (#c9a24a). Mapping noise across the full
   token range walks the midtones through orange and the sheet reads as
   tarnished brass; keeping it inside a third of that range keeps it
   recognisably one gold surface, and leaves the highlight and shadow tokens
   free to do the lighting on top of it in CSS and in three.js. */
const LEAF_LO = "0x9d7a2c";
const LEAF_HI = "0xe4c87b";
const LACQUER = "0x17120f";
const SEAL = "0xc9412a";
const SEAL_INK = "0xf6f0e4";

/* The seal is set in Yu Gothic Bold, which ships with Windows and carries a
   full kana set. A brush or seal-script face would be more period-correct but
   there is no free one with katakana coverage, and a wrong-looking seal is
   worse than a plain one: a real personal hanko cut in gothic is ordinary. */
const FONT = "C\\:/Windows/Fonts/YuGothB.ttc";

/* ---- helpers --------------------------------------------------------- */

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

async function ensureDir(file) {
    await mkdir(path.dirname(file), { recursive: true });
}

/**
 * One octave of value noise: `n` random samples across the tile, resampled up
 * with bicubic so the result is smooth blobs rather than static. Small `n`
 * gives broad tonal drift, large `n` gives grain; summing several is what
 * makes a surface read as material instead of as a gradient.
 */
const octave = (n, size) => octaveXY(n, n, size);

/**
 * As `octave`, but with independent cell counts per axis, so the blobs come out
 * stretched. Fewer cells vertically than horizontally gives broad horizontal
 * drift, which is what scattered powder settles into and what an equal-sided
 * noise never produces on its own.
 */
const octaveXY = (nx, ny, size) =>
    `color=c=black:s=${nx}x${ny},format=gray,geq=lum='random(1)*255',` +
    `scale=${size}:${size}:flags=bicubic`;

/**
 * The same, resampled with nearest so the cells stay hard-edged squares. This
 * is how the individual sheets of leaf are drawn: `n` cells across the tile,
 * each one flat and very slightly different from its neighbours, which is the
 * single most recognisable thing about a gilded surface. `spread` compresses
 * the variation, because real adjacent leaves differ by a little, not a lot.
 */
const blocks = (n, size, spread) =>
    `color=c=black:s=${n}x${n},format=gray,geq=lum='random(1)*255',` +
    `lut=y='128+(val-128)*${spread}',scale=${size}:${size}:flags=neighbor`;

/**
 * Mirrors a tile into a 2x2 block of itself, which removes the seam: the right
 * edge of a quarter always meets its own reflection, so the texture repeats
 * without a visible join in CSS `background-repeat` or three.js wrapping.
 *
 * The cost is a faint bilateral symmetry. On leaf and paper it is invisible
 * under the grid and the grain; it is the reason the grid is drawn *after*
 * this step rather than before, where it would double up along the mirror.
 */
const MIRROR =
    "split=4[m0][m1][m2][m3];" +
    "[m1]hflip[m1f];[m2]vflip[m2f];[m3]hflip,vflip[m3f];" +
    "[m0][m1f]hstack[mt];[m2f][m3f]hstack[mb];[mt][mb]vstack";

/** Maps luminance 0 → `from`, 255 → `to`. Same trick the ink pipeline used. */
function duotone(from, to) {
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(2).slice(i - 1, i + 1), 16));
    const a = rgb(from);
    const b = rgb(to);
    const ch = (i) => `'${a[i]}+${b[i] - a[i]}*val/255'`;
    return `lutrgb=r=${ch(0)}:g=${ch(1)}:b=${ch(2)}`;
}

/** True when the user has dropped a hand-supplied image in for this asset. */
function readIncoming(name) {
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
        const f = path.join(INCOMING, `${name}.${ext}`);
        if (existsSync(f)) return f;
    }
    return null;
}

const WEBP = (q) => ["-c:v", "libwebp", "-quality", String(q), "-compression_level", "6"];
const WEBP_LOSSLESS = ["-c:v", "libwebp", "-lossless", "1", "-pix_fmt", "bgra"];

/* ---- targets --------------------------------------------------------- */

/**
 * Gold leaf, 2048², plus its roughness map.
 *
 * Real kinpaku is applied as small squares that overlap slightly, so the
 * surface has two scales of structure: a regular grid of seams, and slow
 * tonal drift across and within the leaves from the beating and the size
 * underneath. Both are here. The drift is three octaves of value noise
 * compressed toward the middle so the sheet stays recognisably one colour;
 * the seams are two offset grids so the lattice is not perfectly square.
 */
async function gold(force) {
    const albedo = path.join(OUT_BYOBU, "gold-albedo.webp");
    const rough = path.join(OUT_BYOBU, "gold-rough.webp");
    if (!force && existsSync(albedo) && existsSync(rough)) return "gold (exists)";
    await ensureDir(albedo);

    const supplied = readIncoming("gold-leaf");
    const S = 2048;

    /* Built at full size and NOT mirrored, unlike the paper tile. Mirroring
       makes the centre column an axis of symmetry, and gold carries enough
       low-frequency drift that its reflection reads as a bright stripe down
       the middle of every panel. The sheet does not need to tile: it is mapped
       once across a panel in WebGL and drawn with `cover` in CSS.

       Either the supplied image reduced to luminance so the duotone below
       re-lights it in the site's own gold, or two synthesised structures:
       `leaf`, the sheets themselves at 8 cells of 256px, and `mottle`, the
       variation within a sheet. */
    const field = supplied
        ? `[0:v]scale=${S}:${S}:flags=lanczos,format=gray,eq=contrast=0.85:brightness=0.02[q]`
        : `${blocks(8, S, 0.34)}[leaf];` +
          `${octave(20, S)}[m0];${octave(64, S)}[m1];${octave(240, S)}[m2];` +
          `[m0][m1]blend=all_expr='A*0.5+B*0.5'[m01];` +
          `[m01][m2]blend=all_expr='A*0.72+B*0.28',lut=y='128+(val-128)*0.62'[mottle];` +
          `[leaf][mottle]blend=all_expr='A*0.55+B*0.45'[q]`;

    /* The seams. A leaf is laid slightly over its neighbour, so the join is a
       dark hairline with a brighter lip on one side; two offset grids give
       that without drawing each edge by hand.

       Skipped entirely for a supplied image, which already has its own seams
       from whatever it was made of. Drawing ours on top produced a visible
       double lattice: their organic joins, plus our perfectly regular one. */
    const seams = supplied
        ? ""
        : `drawgrid=w=256:h=256:t=2:c=${GOLD_LO}@0.5,` +
          `drawgrid=x=2:y=2:w=256:h=256:t=1:c=${GOLD_HI}@0.3,`;

    const graph =
        `${field};` +
        `[q]${duotone(LEAF_LO, LEAF_HI)}[lit];` +
        `[lit]${seams}split=2[albedo][forRough];` +
        /* Roughness: bright leaf is polished, dark seams and tarnish are not.
           Inverted, softened, then squeezed into 0.30-0.62 so the panel never
           goes mirror-perfect (which would strobe as the screen folds) nor
           fully matte (which would kill the reflection entirely). */
        `[forRough]format=gray,negate,gblur=sigma=2.5,` +
        `lut=y='77+val*0.33',scale=1024:1024[rough]`;

    const args = ["-v", "error", "-y"];
    if (supplied) args.push("-i", supplied);
    args.push(
        "-filter_complex", graph,
        "-map", "[albedo]", "-frames:v", "1", ...WEBP(88), albedo,
        "-map", "[rough]", "-frames:v", "1", ...WEBP(82), rough,
    );
    await run("ffmpeg", args);
    return supplied ? `gold (from ${path.basename(supplied)})` : "gold";
}

/**
 * Sunago: the footer floor. Black urushi with gold dust sprinkled in drifting
 * bands, which is how a real lacquer ground is decorated.
 *
 * The dust is a very high threshold on per-pixel noise, so only a few percent
 * of pixels survive, gated by a low-frequency mask so the particles gather in
 * bands rather than spreading evenly. Dilated once because a single pixel of
 * gold disappears the moment the image is scaled to fit a footer.
 */
async function sunago(force) {
    const out = path.join(OUT_BYOBU, "sunago.webp");
    if (!force && existsSync(out)) return "sunago (exists)";
    await ensureDir(out);

    const supplied = readIncoming("sunago");
    if (supplied) {
        await run("ffmpeg", [
            "-v", "error", "-y", "-i", supplied,
            "-vf", "scale=2048:2048:flags=lanczos,eq=saturation=0.92:contrast=1.05",
            "-frames:v", "1", ...WEBP(86), out,
        ]);
        return `sunago (from ${path.basename(supplied)})`;
    }

    const S = 2048;
    const graph =
        `color=c=${LACQUER}:s=${S}x${S}[floor];` +
        /* The particles. gt(val,251) keeps about 1.6% of pixels, and they stay
           one pixel wide: sunago is dust, and dilating it turns the floor into
           glitter. Density is carried by the gate below, not by grain size. */
        `color=c=black:s=${S}x${S},format=gray,geq=lum='random(1)*255',` +
        `lut=y='if(gt(val,252),255,0)',dilation[dust];` +
        /* The drift. Three octaves rather than one, because a single coarse
           noise upscaled is one blob and reads as a spotlight rather than as
           powder scattered by hand. Ramped, not thresholded, so the bands have
           soft shoulders and the floor is never fully bare or fully covered. */
        /* Few cells across, many down: each source pixel becomes a wide, short
           rectangle, so the drift runs horizontally. The obvious reading of
           the two numbers is the wrong way round, which is worth a comment. */
        `${octaveXY(4, 14, S)}[b1];${octaveXY(9, 30, S)}[b2];${octave(40, S)}[b3];` +
        `[b1][b2]blend=all_expr='A*0.55+B*0.45'[b12];` +
        `[b12][b3]blend=all_expr='A*0.74+B*0.26',` +
        `lut=y='clip((val-96)*2.4,0,255)',gblur=sigma=10[bands];` +
        `[dust][bands]blend=all_mode=multiply,` +
        /* Pushed toward binary. Partial alpha over black desaturates the
           particle into grey, and grey dust on lacquer is dirt, not gold. */
        `lut=y='if(gt(val,40),255,val*2)'[mask];` +
        `color=c=0xe8c46a:s=${S}x${S}[goldsrc];` +
        `[goldsrc][mask]alphamerge[grains];` +
        `[floor][grains]overlay=format=auto,format=rgb24[out]`;

    await run("ffmpeg", [
        "-v", "error", "-y", "-filter_complex", graph,
        "-map", "[out]", "-frames:v", "1", ...WEBP(86), out,
    ]);
    return "sunago";
}

/**
 * Washi tooth, 512² grayscale. Not shipped to the browser: this is the tile
 * the print pipeline multiplies over every frame so the pigment sits on paper
 * fibre instead of on a flat rectangle. Kept as PNG because it is an input to
 * another filter graph and lossy artefacts would compound.
 */
async function washi(force) {
    const out = path.join(OUT_ASSETS, "washi-tooth.png");
    if (!force && existsSync(out)) return "washi (exists)";
    await ensureDir(out);

    const graph =
        `${octave(220, 256)}[fine];` +
        `${octave(40, 256)}[broad];` +
        `[fine][broad]blend=all_expr='A*0.7+B*0.3',` +
        `gblur=sigma=0.5,lut=y='128+(val-128)*0.42',format=gray[q];` +
        `[q]${MIRROR}[out]`;

    await run("ffmpeg", [
        "-v", "error", "-y", "-filter_complex", graph,
        "-map", "[out]", "-frames:v", "1", out,
    ]);
    return "washi";
}

/**
 * The hanko: アンブド (Ambud) cut as a square seal.
 *
 * 白文 style, characters knocked out of a solid vermilion ground, because at
 * 20px in the dock a solid block of colour with light shapes in it stays
 * legible where thin red strokes on a light ground would not.
 *
 * The characters are laid out the way a real seal is read: down the right
 * column first, then down the left. So the right column is ア then ン, and the
 * left column is ブ then ド, which looks reversed to a Latin reader and is
 * correct.
 */
async function hanko(force) {
    const big = path.join(OUT_BRAND, "hanko-512.webp");
    const small = path.join(OUT_BRAND, "hanko-128.webp");
    if (!force && existsSync(big) && existsSync(small)) return "hanko (exists)";
    await ensureDir(big);

    const S = 512;
    const PAD = 26;      // the inner frame line's inset
    const T = 7;         // its thickness
    const FS = 152;      // character size

    /* Quadrant centres inside the frame. */
    const lo = PAD + (S - 2 * PAD) / 4;
    const hi = S - lo;
    const cell = (cx, cy, text) =>
        `drawtext=fontfile='${FONT}':text='${text}':fontcolor=${SEAL_INK}:fontsize=${FS}` +
        `:x=${cx}-text_w/2:y=${cy}-text_h/2`;

    const graph =
        `color=c=${SEAL}:s=${S}x${S},format=rgba,` +
        `drawbox=x=${PAD}:y=${PAD}:w=${S - 2 * PAD}:h=${S - 2 * PAD}:c=${SEAL_INK}:t=${T},` +
        [
            cell(hi, lo, "ア"),
            cell(hi, hi, "ン"),
            cell(lo, lo, "ブ"),
            cell(lo, hi, "ド"),
        ].join(",") +
        /* A seal is stamped by hand, so it is never quite square to the page.
           The rotation is baked in rather than applied in CSS so the mark
           carries its tilt into WebGL, print and favicons identically. */
        `,rotate=-3*PI/180:c=none:ow=rotw(-3*PI/180):oh=roth(-3*PI/180),` +
        `format=rgba,split=2[b][s];` +
        `[s]scale=128:-1:flags=lanczos[sm]`;

    await run("ffmpeg", [
        "-v", "error", "-y", "-filter_complex", graph,
        "-map", "[b]", "-frames:v", "1", ...WEBP_LOSSLESS, big,
        "-map", "[sm]", "-frames:v", "1", ...WEBP_LOSSLESS, small,
    ]);
    return "hanko";
}

/**
 * The two side paintings for the hero's outer panel pairs.
 *
 * Unlike the other targets these cannot be synthesised: a pine branch and a
 * cloud band are a painting, not a material. So this target exists only to
 * grade and size art supplied in public/_incoming/, and when there is none it
 * emits nothing at all and the outer panels stay plain gold, which is what a
 * great many real screens are anyway.
 *
 * Graded to sit with the rest: pulled slightly toward the site's gold so the
 * painted ground matches the plain leaf on the panels beside it, and dropped a
 * little in contrast so the pigments read as laid on the leaf rather than as a
 * photograph pasted over it.
 */
async function panels(force) {
    const done = [];
    for (const side of ["left", "right"]) {
        const out = path.join(OUT_BYOBU, `side-${side}.webp`);
        const supplied = readIncoming(`side-${side}`);
        if (!supplied) continue;
        if (!force && existsSync(out)) {
            done.push(`${side} (exists)`);
            continue;
        }
        await ensureDir(out);
        await run("ffmpeg", [
            "-v", "error", "-y", "-i", supplied,
            "-vf",
            "scale=2048:1152:flags=lanczos:force_original_aspect_ratio=increase," +
            "crop=2048:1152,eq=contrast=0.94:saturation=0.96:brightness=0.01," +
            `colorbalance=rm=0.04:gm=0.01:bm=-0.05`,
            "-frames:v", "1", ...WEBP(88), out,
        ]);
        done.push(side);
    }
    return done.length ? `panels: ${done.join(", ")}` : "panels (none supplied)";
}

/* ---- main ------------------------------------------------------------ */

const TARGETS = { gold, sunago, washi, hanko, panels };

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const only = argv.filter((a) => !a.startsWith("--"));
const chosen = only.length ? only : Object.keys(TARGETS);

for (const name of chosen) {
    const fn = TARGETS[name];
    if (!fn) {
        console.error(`unknown target: ${name}  (have: ${Object.keys(TARGETS).join(" ")})`);
        process.exitCode = 1;
        continue;
    }
    try {
        process.stdout.write(`${name} ... `);
        const note = await fn(force);
        process.stdout.write(`${note}\n`);
    } catch (e) {
        process.stdout.write("failed\n");
        console.error(e.message);
        process.exitCode = 1;
    }
}
