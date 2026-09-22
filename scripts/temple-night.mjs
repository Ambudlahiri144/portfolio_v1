/* ==================================================================
   THE TEMPLE NIGHT RENDERER — extracted, then re-themed

   Reads the vendored Kage source and writes the renderer module the
   React host imports, retinted to the sakura-moon theme.

   Run: node scripts/temple-night.mjs

   source   src/shaders/temple-night/sources/kage.html
   derived  src/shaders/temple-night/templeNightRenderer.js

   ------------------------------------------------------------------
   WHY A SCRIPT, AND NOT A HAND-COPIED FILE.

   The authored world is ~2,800 lines of JavaScript and GLSL inside a
   landing page. Copying it by hand would be a one-way operation: the
   diff against the source would exist only in my head, a mistake in the
   middle of a shader string would be invisible, and re-theming would mean
   editing hundreds of colour literals in place with nothing checking that
   each one was found.

   So every difference from the source is one entry below — a named
   region that is kept or dropped, or a named edit whose match count is
   asserted. An edit that stops matching fails the build instead of
   silently doing nothing, which is the failure mode that matters here:
   a colour that quietly does not get replaced looks like a design
   decision, not like a bug.

   ------------------------------------------------------------------
   THE SOURCE OF TRUTH IS THE HTML, NOT THE SHIPPED MODULE.

   @designcodeio/threeui also ships lib-dist/shaders/temple-night/
   templeNightRenderer.js, and it is NOT used here. Two reasons:

     · It is minified build output — mangled identifiers, no comments.
       Re-theming it would mean editing colour literals inside code
       nobody can read, and the result would be unmaintainable.
     · It is the Kage theme with every colour hard-coded. There is no
       seam in it to hang a theme module on.

   The vendored kage.html is the authored source: 4,821 readable lines
   with its regions banner-commented, which is what makes the region
   split below possible at all.

   A NOTE ON CORRUPTION. The skill warns that copies of the extracted
   module circulated through chat and markdown, where `*` inside a `_`
   or `*` run is eaten: `uT*1.35` becomes `uT1.35`, `c *= uExp` becomes
   `c = uExp`. Such a file is still valid JavaScript, fails to compile as
   GLSL, and renders a black canvas with no readable error. The copy read
   here came out of the npm tarball and has never been through a markdown
   renderer — and the parse check at the end is a second line of defence.
   ================================================================== */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";

const DIR = resolve("src/shaders/temple-night");
const SOURCE = resolve(DIR, "sources/kage.html");
const DERIVED = resolve(DIR, "templeNightRenderer.js");

/* ---- the script, isolated from the page ---------------------------- */

const RUNTIME_TAG = '<script src="secret-pathways-assets/three.min.js"></script>';

function isolateScript(html) {
    const at = html.indexOf(RUNTIME_TAG);
    if (at < 0) throw new Error("kage.html: the three.min.js tag is gone; the source has changed.");
    const open = html.indexOf("<script>", at);
    const close = html.lastIndexOf("</script>");
    if (open < 0 || close <= open) throw new Error("kage.html: could not isolate the world script.");
    return html.slice(open + "<script>".length, close);
}

/* ---- the regions ---------------------------------------------------
   The source banner-comments its own sections, which is what lets this
   be a list of names rather than a list of line numbers. Each entry is
   matched as a substring of its banner line; `keep: false` means the
   region is page furniture that the scene-only integration does not
   want. Order matters — the file is sliced between consecutive markers.

   What is dropped is the LANDING PAGE, not the world: the chapter cards
   and their render-to-texture viewports, the scroll-to-chapter mapping,
   the subset-font wordmark and its layout, and the page's own wiring
   (menu, links, section observers). The world, its textures, its post
   chain, its camera rig and its loop all stay.

   The foreground cut-outs stay despite their name: they are painted to
   a 2-D canvas at load like every other texture here, not loaded from
   the .webp plates the landing page hangs in its own DOM. */
const REGIONS = [
    { mark: "0 · basics", keep: true },
    { mark: "1 · canvas", keep: true },
    { mark: "2 · surfaces", keep: true },
    { mark: "3 · the foreground cut-outs", keep: true },
    { mark: "4 · gl", keep: true },
    { mark: "5 · the world", keep: true },
    { mark: "6b · the leaf fall", keep: true },
    { mark: "6c · the cursor wisps", keep: true },
    /* `until` because this region does not end where its banner does.
       buildLights() — a WORLD function, not page furniture — sits after the
       cloth code and before the next banner, so slicing on banners alone
       swallowed it and the scene booted with no lights at all. The
       undefined-symbol gate below is what caught that. */
    { mark: "cloth · the plates", keep: false, until: "function buildLights()" },
    { mark: "6 · planar mirror", keep: true },
    { mark: "7 · post-processing", keep: true },
    { mark: "8 · the camera rig", keep: true },
    { mark: "9 · scroll ↔ chapters", keep: false },
    { mark: "10 · the wordmark layout", keep: false },
    { mark: "11 · page wiring", keep: false },
    { mark: "12 · the card viewports", keep: false },
    { mark: "13 · the machine", keep: true },
    { mark: "14 · booting", keep: true },
];

/* A sub-block inside region 5. The wordmark is a subset font drawn as
   geometry for the landing page's title and has no place in a scene
   embedded in someone else's layout. */
const SUB_DROPS = [
    { from: "the giant wordmark */", to: "atmospherics */", label: "the giant wordmark" },
];

function splitRegions(src) {
    const found = REGIONS.map((r) => {
        const at = src.indexOf(r.mark);
        if (at < 0) throw new Error(`REGION LOST: ${r.mark}\nThe source's section banners have changed.`);
        /* rewind to the start of the banner's own comment line */
        const lineStart = src.lastIndexOf("/*", at);
        return { ...r, at: lineStart < 0 ? at : lineStart };
    });
    for (let i = 1; i < found.length; i++) {
        if (found[i].at <= found[i - 1].at) {
            throw new Error(`REGION OUT OF ORDER: ${found[i].mark} precedes ${found[i - 1].mark}.`);
        }
    }

    const head = src.slice(0, found[0].at);
    let out = head;
    const dropped = [];
    for (let i = 0; i < found.length; i++) {
        const end = i + 1 < found.length ? found[i + 1].at : src.length;
        if (found[i].keep) { out += src.slice(found[i].at, end); continue; }
        dropped.push(found[i].mark);
        if (found[i].until) {
            const stop = src.indexOf(found[i].until, found[i].at);
            if (stop < 0 || stop > end) {
                throw new Error(`REGION TAIL LOST: ${found[i].mark} expected to stop at "${found[i].until}".`);
            }
            out += src.slice(stop, end);
        }
    }
    return { out, dropped };
}

function applySubDrops(src) {
    let out = src;
    for (const d of SUB_DROPS) {
        const a = out.indexOf(d.from);
        const b = out.indexOf(d.to, a);
        if (a < 0 || b < 0 || b <= a) {
            throw new Error(`SUB-BLOCK LOST: ${d.label}\nExpected "${d.from}" … "${d.to}".`);
        }
        const start = out.lastIndexOf("/*", a);
        const end = out.lastIndexOf("/*", b);
        out = out.slice(0, start) + `/* ${d.label}: removed, page furniture. */\n\n` + out.slice(end);
    }
    return out;
}

/* ---- the edits -------------------------------------------------------
   Everything below turns a page script into a module, and every entry
   asserts how many times it matched. The page furniture these calls
   belonged to has already been dropped by region; what is left here is the
   CALL SITES inside kept code, which would otherwise throw on first frame.

   Structure only. The sakura-moon re-theme is a separate list, so that
   "what makes this a module" and "what makes this pink" never get
   confused for one another. */
const STRUCTURE = [
    {
        label: "the IIFE becomes an exported factory",
        find: /\(function \(\) \{\n'use strict';/,
        to: () =>
            'import * as THREE from "three";\nimport THEME from "./theme.js";\n\n' +
            "export function createTempleNightRenderer(canvas) {\n'use strict';",
        expect: 1,
    },
    {
        /* THREE ARRIVES AS AN IMPORT, NOT AS A GLOBAL.

           The page loaded three.js from a <script> tag, so the world's own
           guard asked window.THREE whether a renderer was possible at all.
           A module imports it instead, window.THREE is undefined, and the
           guard threw 'webgl disabled' before a single object was built —
           with the host then faithfully reporting WebGL as unavailable on
           a machine where it was perfectly fine. The ?nogl= escape hatch
           is authored behaviour and is left alone. */
        label: "the three.js availability guard reads the import",
        find: /if \(qs\('nogl', '0'\) !== '0' \|\| !window\.THREE\) throw new Error\('webgl disabled'\);/,
        to: () => "if (qs('nogl', '0') !== '0') throw new Error('webgl disabled by ?nogl=');",
        expect: 1,
    },
    {
        label: "the canvas comes from the host, not from the document",
        find: /const canvas = document\.getElementById\('gl'\);/,
        to: () =>
            "/* canvas is the argument. The page looked itself up by id; a\n" +
            "   component is handed the element it owns. */\n" +
            "if (!canvas) throw new Error('temple-night: no canvas supplied.');",
        expect: 1,
    },
    {
        label: "the viewport is the canvas box, not the document",
        find: /const vpW = \(\) => document\.documentElement\.clientWidth  \|\| innerWidth;\nconst vpH = \(\) => document\.documentElement\.clientHeight \|\| innerHeight;/,
        to: () =>
            "/* THE SCENE IS A BOX ON SOMEONE ELSE'S PAGE, not the page.\n" +
            "   Measuring the document would size the drawing buffer to the\n" +
            "   window and stretch the world across whatever slice of it the\n" +
            "   host reserved. The canvas's own parent is the only honest\n" +
            "   answer, with a floor so a parent that has not been laid out\n" +
            "   yet cannot produce a zero-sized render target. */\n" +
            "const vpBox = () => (canvas.parentElement || canvas);\n" +
            "const vpW = () => Math.max(1, vpBox().clientWidth  || canvas.clientWidth  || 1);\n" +
            "const vpH = () => Math.max(1, vpBox().clientHeight || canvas.clientHeight || 1);",
        expect: 1,
    },
    {
        label: "resize: drop the page's --vw custom property",
        find: /\n  document\.documentElement\.style\.setProperty\('--vw', w \+ 'px'\);/,
        to: () => "",
        expect: 1,
    },
    {
        label: "resize: drop the card-viewport invalidation",
        find: /\n  CARDS\.forEach\(C => \{ C\.dirty = true; \}\);/,
        to: () => "",
        expect: 1,
    },
    {
        label: "resize: drop the wordmark and page measurements",
        find: /\n  layoutWord\(\);\n  measure\(\);/,
        to: () => "",
        expect: 1,
    },
    {
        label: "updateWorld: drop the wordmark reveal",
        find: /\n  \/\* the type rises from behind the grass[\s\S]*?\n  \}\n(?=  \/\* the cut-out layers)/,
        to: () => "\n",
        expect: 1,
    },
    {
        label: "updateWorld: drop the card-camera push",
        find: /\n  if \(CARDS\.length\) CARDS\.forEach\(C => \{ const u = C\.cam\.userData; u\.push = damp\(u\.push, u\.want, 3\.4, dt\); \}\);/,
        to: () => "",
        expect: 1,
    },
    {
        label: "render: drop the card-viewport pass",
        find: /\n  renderCards\(WANT_POST \? POST\.scene : null\);/,
        to: () => "",
        expect: 1,
    },
    {
        /* The rig was driven along its waypoints by page scroll, through
           chapter sections that no longer exist. Holding 0 keeps the
           authored hero framing and leaves the intro ease and the pointer
           parallax — the parts about the scene rather than about the page
           it used to live on — running untouched. */
        label: "the camera holds its hero waypoint",
        find: /RIG\.prog = progressFor\(scrollY\);/,
        to: () => "RIG.prog = 0;   /* the hero waypoint; no chapters to scroll through */",
        expect: 1,
    },
    {
        label: "frame: drop the wordmark reveal clock",
        find: /\n    WORD\.reveal = Math\.min\(1\.2, el \/ 1\.5\);/,
        to: () => "",
        expect: 1,
    },
    {
        /* The page drove itself. A React host already has a rAF loop, a
           visibility gate and an IntersectionObserver; two schedulers on one
           renderer means two frames per tick and a doubled clock. */
        label: "the host owns the animation loop",
        find: /\n  render\(\);\n  queue\(\);\n\}\nconst TIMER = qs\('driver', 'raf'\) === 'timer';\nfunction queue\(\) \{ TIMER \? setTimeout\(\(\) => frame\(performance\.now\(\)\), 16\) : requestAnimationFrame\(frame\); \}/,
        to: () => "\n  render();\n}",
        expect: 1,
    },
    {
        label: "JOBS: drop the wordmark font load",
        find: /\n  \['Reading the type', \(\) => document\.fonts && document\.fonts\.load\('600 320px Wordmark'\)\],/,
        to: () => "",
        expect: 1,
    },
    {
        label: "JOBS: drop the wordmark build",
        find: /\n  \['Cutting the word', \(\) => buildWordmark\(\)\],/,
        to: () => "",
        expect: 1,
    },
    {
        label: "JOBS: drop the card builds",
        find: /initPost\(\); buildCards\(\); buildCardCloth\(\);/,
        to: () => "initPost();",
        expect: 1,
    },
    {
        label: "JOBS: drop the wordmark layer assignment",
        find: /\n    WORD\.glyphs\.forEach\(m => m\.layers\.set\(2\)\);/,
        to: () => "",
        expect: 1,
    },
    {
        label: "JOBS: drop the wordmark and page layout pass",
        find: /\n    layoutWord\(\); measure\(\);/,
        to: () => "",
        expect: 1,
    },
];

/* ---- the re-theme ----------------------------------------------------
   Kage is a teal night with a blood moon, red maple, rain on standing
   water. sakura-moon is a violet night with a rose moon, cherry blossom
   and a clear, still sky. Everything that separates the two is here, and
   every entry reads from theme.js rather than restating a colour — a hex
   that appears in two files drifts.

   The skill's rule for the re-theme is that it changes constants and the
   blossom/cloud generators, and nothing else: no geometry generator, no
   pass structure, no interaction model. These edits hold to that.

   ONE WARM HUE. The reference plate has exactly one — the lantern and
   shoji amber — inside a violet-to-mauve field, with the moon as a cool
   rose. Kage has three warm sources (its moon is warm too, and so is its
   fill). Moving the moon and the fill to rose and violet is what makes
   the frame read as one accent instead of a fire. */
const THEMING = [
    {
        label: "atmosphere: the renderer clear",
        find: /renderer\.setClearColor\(0x05070a, 1\);/,
        to: () => "renderer.setClearColor(THEME.air.clear, 1);",
        expect: 1,
    },
    {
        /* Density as well as hue. Kage's 0.0168 is tuned for a frame whose
           background is a wall of cedar; this plate keeps three readable
           hill layers, and 0.0168 eats the second. */
        label: "atmosphere: the fog",
        find: /scene\.fog = new THREE\.FogExp2\(0x050a0e, 0\.0168\);/,
        to: () => "scene.fog = new THREE.FogExp2(THEME.air.fog, THEME.air.fogDensity);",
        expect: 1,
    },
    {
        label: "atmosphere: the scene background",
        find: /scene\.background = new THREE\.Color\(0x060a0d\);/,
        to: () => "scene.background = new THREE.Color(THEME.air.background);",
        expect: 1,
    },

    /* ---- the lights. Nine sources; the two that decide whether the frame
       reads warm or cool are moonKey and fill, both of which were warm in
       Kage and are rose and violet here. ---- */
    {
        label: "light: hemisphere",
        find: /scene\.add\(new THREE\.HemisphereLight\(0x53838f, 0x060a08, \.13\)\);/,
        to: () => "scene.add(new THREE.HemisphereLight(THEME.light.hemiSky, THEME.light.hemiGround, THEME.light.hemi));",
        expect: 1,
    },
    {
        label: "light: the key",
        find: /const key = new THREE\.DirectionalLight\(0xb6dbe4, 1\.22\);/,
        to: () => "const key = new THREE.DirectionalLight(THEME.light.key, THEME.light.keyI);",
        expect: 1,
    },
    {
        label: "light: the moon key",
        find: /const moonKey = new THREE\.DirectionalLight\(0xff6a42, \.52\);/,
        to: () => "const moonKey = new THREE.DirectionalLight(THEME.light.moonKey, THEME.light.moonKeyI);",
        expect: 1,
    },
    {
        label: "light: the hall",
        find: /const hallL = new THREE\.PointLight\(0xff8a26, 2\.3, 15, 2\);/,
        to: () => "const hallL = new THREE.PointLight(THEME.light.hall, THEME.light.hallI, 15, 2);",
        expect: 1,
    },
    {
        label: "light: the wings",
        find: /const w = new THREE\.PointLight\(0xff8420, 2\.2, 11, 2\);/,
        to: () => "const w = new THREE.PointLight(THEME.light.wing, THEME.light.wingI, 11, 2);",
        expect: 1,
    },
    {
        label: "light: the moon's own point",
        find: /const moonL = new THREE\.PointLight\(0xff3a1c, 3\.0, 46, 2\);/,
        to: () => "const moonL = new THREE.PointLight(THEME.light.moonPoint, THEME.light.moonPointI, 46, 2);",
        expect: 1,
    },
    {
        label: "light: the fill",
        find: /const fill = new THREE\.PointLight\(0x86c6d2, 0\.95, 30, 2\);/,
        to: () => "const fill = new THREE.PointLight(THEME.light.fill, THEME.light.fillI, 30, 2);",
        expect: 1,
    },
    {
        label: "light: the stair",
        find: /const stairL = new THREE\.PointLight\(0xffa049, 4\.2, 17, 2\);/,
        to: () => "const stairL = new THREE.PointLight(THEME.light.stair, THEME.light.stairI, 17, 2);",
        expect: 1,
    },
    {
        label: "light: the lanterns",
        find: /const lt = new THREE\.PointLight\(0xff5a24, 2\.6, 9, 2\);/,
        to: () => "const lt = new THREE.PointLight(THEME.light.lantern, THEME.light.lanternI, THEME.light.lanternRange, 2);",
        expect: 1,
    },

    /* ---- the grade. This is where the violet shadows live, and it is why
       the skill forbids swapping the composite for a stock bloom pass: an
       UnrealBloomPass has a threshold and a strength and nothing else. ---- */
    {
        label: "grade: the bright pass threshold and knee",
        find: /uniforms: \{ tS: \{ value: null \}, uThr: \{ value: \.86 \}, uKnee: \{ value: \.50 \} \},/,
        to: () => "uniforms: { tS: { value: null }, uThr: { value: THEME.post.threshold }, uKnee: { value: THEME.post.knee } },",
        expect: 1,
    },
    {
        /* Flatter than Kage on purpose: the reference is vector-flat
           illustration and a film grade fights it. Lower grain, lower
           chromatic aberration, exposure up, saturation up. */
        label: "grade: the composite uniforms",
        find: /      uT: \{ value: 0 \}, uBloom: \{ value: \.34 \}, uCA: \{ value: 1 \}, uGrain: \{ value: \.020 \},\n      uVig: \{ value: 1 \}, uExp: \{ value: \.62 \}, uFade: \{ value: 1 \}, uSat: \{ value: 1\.05 \}/,
        to: () =>
            "      uT: { value: 0 }, uBloom: { value: THEME.post.bloom }, uCA: { value: THEME.post.chroma }, uGrain: { value: THEME.post.grain },\n" +
            "      uVig: { value: THEME.post.vignette }, uExp: { value: THEME.post.exposure }, uFade: { value: 1 }, uSat: { value: THEME.post.saturation }",
        expect: 1,
    },

    /* ---- weather. The plate is a clear, still night. ---- */
    {
        /* Rain off. The guard stays rather than the block being deleted, so
           the authored rain is one theme flag away and the diff against the
           source stays legible. */
        label: "weather: the rain",
        find: /  \/\* rain in the slot of open sky \*\/\n  if \(!LOW\) \{/,
        to: () => "  /* rain in the slot of open sky — off in sakura-moon */\n  if (THEME.weather.rain && !LOW) {",
        expect: 1,
    },
    {
        label: "weather: the ripples",
        find: /  for \(let i = 0; i < \(LOW \? 6 : 13\); i\+\+\) \{/,
        to: () => "  for (let i = 0; i < Math.min(THEME.weather.ripples, LOW ? 6 : 13); i++) {",
        expect: 1,
    },

    /* ---- the camera. Same six waypoints, re-framed: this composition puts
       the gate in the foreground and the moon higher and further right. ---- */
    {
        /* ---- the canopy. This is the change the eye reads first: Kage's
           maple is a deep oxblood leaf on near-black bark, and sakura is
           pale blossom on a violet-brown limb. The geometry generator is
           untouched — same branch recursion, same instanced quads, same
           per-tip scatter — only what they are painted with, and how many
           of them a tip carries. ---- */
        label: "sakura: the canopy bark",
        find: /new THREE\.MeshStandardMaterial\(\{ color: 0x171413, roughness: \.94, metalness: \.0, side: THREE\.DoubleSide \}\)\);/,
        to: () => "new THREE.MeshStandardMaterial({ color: THEME.sakura.bark, roughness: .94, metalness: .0, side: THREE.DoubleSide }));",
        expect: 1,
    },
    {
        label: "sakura: the canopy blossom",
        find: /    map: tx\(texLeaf\(\)\), color: 0x2b0406, alphaTest: \.42, side: THREE\.DoubleSide,\n    roughness: \.86, metalness: 0, emissive: 0x080000, emissiveIntensity: \.12/,
        to: () =>
            "    map: tx(texLeaf()), color: THEME.sakura.petal, alphaTest: .42, side: THREE.DoubleSide,\n" +
            "    roughness: .86, metalness: 0, emissive: THEME.sakura.emissive, emissiveIntensity: THEME.sakura.emissiveIntensity",
        expect: 1,
    },
    {
        /* PER-INSTANCE COLOUR, which the skill names as part of sakura-moon
           and the source never had: every maple quad was the one material
           colour. Pale blossom under a lavender key and three amber point
           lights came out of that as cream on the lit side and tan on the
           lantern side — measured at saturation 0.16 against a plate that is
           plainly pink.

           So the material goes white and each quad carries its own colour,
           drawn between the theme's deep and pale petal around its base.
           Scatter across a cluster is also what makes blossom read as
           blossom rather than as a pink sponge. */
        label: "sakura: the canopy material defers to its instances",
        find: /    map: tx\(texLeaf\(\)\), color: THEME\.sakura\.petal, alphaTest: \.42, side: THREE\.DoubleSide,\n    roughness: \.86, metalness: 0, emissive: THEME\.sakura\.emissive, emissiveIntensity: THEME\.sakura\.emissiveIntensity\n  \}\);/,
        to: () =>
            "    map: tx(texLeaf()), color: 0xffffff, alphaTest: .42, side: THREE.DoubleSide,\n" +
            "    roughness: .86, metalness: 0, emissive: THEME.sakura.emissive, emissiveIntensity: THEME.sakura.emissiveIntensity\n" +
            "  });\n" +
            "  /* Its own stream, NOT rnd(). Drawing colours from the geometry's\n" +
            "     generator would shift every value after the first — every\n" +
            "     blossom's position and spin, and the tree's own rotation — and\n" +
            "     the re-theme is not allowed to move geometry. */\n" +
            "  const crnd = mulberry32(seed * 7 + 1);\n" +
            "  const cBase = new THREE.Color(THEME.sakura.petal), cHi = new THREE.Color(THEME.sakura.petalHi);\n" +
            "  const cLo = new THREE.Color(THEME.sakura.petalLo), cOut = new THREE.Color();\n" +
            "  const blossomColour = () => cOut.copy(cBase).lerp(crnd() < .5 ? cHi : cLo, crnd() * .85);",
        expect: 1,
    },
    {
        label: "sakura: each blossom takes its colour",
        find: /      inst\.setMatrixAt\(k\+\+, m4\);\n    \}\n  \}\);\n  inst\.instanceMatrix\.needsUpdate = true;/,
        to: () =>
            "      inst.setMatrixAt(k, m4);\n" +
            "      inst.setColorAt(k++, blossomColour());\n" +
            "    }\n" +
            "  });\n" +
            "  inst.instanceMatrix.needsUpdate = true;\n" +
            "  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;",
        expect: 1,
    },
    {
        /* Blossom clusters read denser than maple leaves do — 9 quads a tip
           looks sparse once they are pale. */
        label: "sakura: the canopy density",
        find: /  const per = LOW \? 5 : 9;/,
        to: () => "  const per = LOW ? Math.max(3, THEME.sakura.canopyPerTip - 6) : THEME.sakura.canopyPerTip;",
        expect: 1,
    },
    {
        /* The fall. Petals are smaller and lighter than leaves: they hang
           rather than drop, which is the speed range in the theme, and there
           are more of them because each one covers less. */
        label: "sakura: the falling petals",
        find: /    color: 0x40080a, roughness: \.84, metalness: 0,/,
        to: () => "    color: THEME.sakura.petal, roughness: .84, metalness: 0,",
        expect: 1,
    },
    {
        label: "sakura: the petals' own glow",
        find: /    emissive: 0x780200, emissiveIntensity: \.72/,
        to: () => "    emissive: THEME.sakura.emissive, emissiveIntensity: THEME.sakura.emissiveIntensity * 2.4",
        expect: 1,
    },
    /* ---- the helpers every painter below reads the theme through ---- */
    {
        /* Painters draw in CSS strings; the theme holds most surfaces as 0x
           ints because three wants them that way. One unpacker, next to the
           packer the painters already use, so neither side restates a hex. */
        label: "helpers: unpack theme colours for the 2-D painters",
        find: /const hex = \(r, g, b\) => 'rgb\(' \+ \(r \| 0\) \+ ',' \+ \(g \| 0\) \+ ',' \+ \(b \| 0\) \+ '\)';/,
        to: (m) =>
            m + "\n" +
            "const rgbOf = n => [(n >> 16) & 255, (n >> 8) & 255, n & 255];\n" +
            "const mixHex = (a, b, t) => { const p = rgbOf(a), q = rgbOf(b);\n" +
            "  return hex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t); };\n" +
            "/* GLSL wants a float literal, and a bare 1 is an int. */\n" +
            "const glf = v => (+v).toFixed(4);\n" +
            "const glv3 = a => 'vec3(' + a.map(glf).join(',') + ')';",
        expect: 1,
    },

    /* ---- the blossom. The one generator the re-theme is allowed to
       rewrite, and the one it has to: Kage's leaf is five pointed lobes
       fanned from a stem, which reads as maple at any size and any tint.
       A cherry blossom is five ROUNDED petals set radially, each notched at
       its tip. Same canvas, same white alpha mask, same callers — the
       canopy, the foreground bough and the fall all pick it up. ---- */
    {
        label: "sakura: the blossom replaces the maple leaf",
        find: /function texLeaf\(\) \{[\s\S]*?\n  return c;\n\}/,
        to: () =>
            "/* Named texLeaf still, because the canopy, the foreground bough and\n" +
            "   the fall all ask for it by that name — but it paints a blossom:\n" +
            "   five rounded petals around a centre, each with the notch at its\n" +
            "   tip that separates a cherry petal from every other five-petal\n" +
            "   flower. White, because it is an alpha mask; the colour is the\n" +
            "   caller's. */\n" +
            "function texLeaf() {\n" +
            "  const S = 128, c = cvs(S, S), x = c.getContext('2d');\n" +
            "  const L = S * .47, W = S * .205;\n" +
            "  x.fillStyle = '#fff';\n" +
            "  for (let i = 0; i < 5; i++) {\n" +
            "    x.save(); x.translate(S / 2, S / 2); x.rotate(i / 5 * TAU);\n" +
            "    x.beginPath(); x.moveTo(0, 0);\n" +
            "    x.bezierCurveTo(W * .92, -L * .24, W * 1.06, -L * .78, W * .40, -L * .98);\n" +
            "    x.quadraticCurveTo(W * .13, -L * .86, 0, -L * .83);\n" +
            "    x.quadraticCurveTo(-W * .13, -L * .86, -W * .40, -L * .98);\n" +
            "    x.bezierCurveTo(-W * 1.06, -L * .78, -W * .92, -L * .24, 0, 0);\n" +
            "    x.fill(); x.restore();\n" +
            "  }\n" +
            "  /* a few bruises, fewer and finer than the leaf's insect holes —\n" +
            "     petals are too small to carry many */\n" +
            "  x.globalCompositeOperation = 'destination-out';\n" +
            "  const rnd = mulberry32(3);\n" +
            "  for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(rnd() * S, rnd() * S, rnd() * 1.5, 0, TAU); x.fill(); }\n" +
            "  return c;\n" +
            "}",
        expect: 1,
    },
    {
        /* Each cluster on the painted foreground bough was tinted oxblood by
           hand. It now runs between the theme's low and high petal, so the
           cut-out and the 3-D canopy are the same flower. */
        label: "sakura: the foreground bough's blossom tint",
        find: /tx\.fillStyle = hex\(96 \+ v \* 96, 14 \+ v \* 22, 16 \+ v \* 18\);/,
        to: () => "tx.fillStyle = mixHex(THEME.sakura.petalLo, THEME.sakura.petalHi, v);",
        expect: 1,
    },
    {
        label: "sakura: the foreground bough's bark",
        find: /x\.strokeStyle = 'rgba\(' \+ \(26 \+ depth \* 5 \| 0\) \+ ',' \+ \(22 \+ depth \* 4 \| 0\) \+ ',' \+ \(22 \+ depth \* 4 \| 0\) \+ ',1\)';/,
        to: () =>
            "{ const b = rgbOf(THEME.sakura.bark); x.strokeStyle = hex(b[0] * .62 + depth * 5, b[1] * .62 + depth * 4, b[2] * .62 + depth * 4); }",
        expect: 1,
    },
    {
        label: "sakura: blossom per cluster on the foreground bough",
        find: /      for \(let i = 0; i < 9; i\+\+\)\n        leaves\.push/,
        to: () => "      for (let i = 0; i < THEME.sakura.canopyPerTip; i++)\n        leaves.push",
        expect: 1,
    },

    /* ---- the fall: petals hang where leaves dropped ---- */
    {
        label: "fall: how many petals",
        find: /  const N = LOW \? 110 : 260;/,
        to: () => "  const N = LOW ? Math.round(THEME.sakura.fall.count * .42) : THEME.sakura.fall.count;",
        expect: 1,
    },
    {
        label: "fall: petal size",
        find: /new THREE\.InstancedMesh\(new THREE\.PlaneGeometry\(\.40, \.40\), mat, N\);/,
        to: () => "new THREE.InstancedMesh(new THREE.PlaneGeometry(THEME.sakura.fall.size, THEME.sakura.fall.size), mat, N);",
        expect: 1,
    },
    {
        label: "fall: petals hang, leaves drop",
        find: /    fall: \.5 \+ rnd\(\) \* \.9,\n    sway: \.45 \+ rnd\(\) \* 1\.5, swayPh: rnd\(\) \* TAU, swayAmp: \.30 \+ rnd\(\) \* \.95,/,
        to: () =>
            "    fall: THEME.sakura.fall.speed[0] + rnd() * THEME.sakura.fall.speed[1],\n" +
            "    sway: .45 + rnd() * 1.5, swayPh: rnd() * TAU,\n" +
            "    swayAmp: THEME.sakura.fall.sway[0] + rnd() * THEME.sakura.fall.sway[1],",
        expect: 1,
    },
    {
        label: "fall: the recycling cone",
        find: /const LEAF_AHEAD = 11, LEAF_SPREAD = 12, LEAF_R = 30;/,
        to: () =>
            "const LEAF_AHEAD = THEME.sakura.fall.ahead, LEAF_SPREAD = THEME.sakura.fall.spread, LEAF_R = THEME.sakura.fall.radius;",
        expect: 1,
    },

    /* ---- the sky: violet, not teal; and the glow behind the ridge is rose
       rather than a warm valley bloom, because the frame gets one warm
       hue and it belongs to the lanterns. ---- */
    {
        label: "sky: the gradient",
        find: /  g\.addColorStop\(0, 'rgb\(6,10,15\)'\);    g\.addColorStop\(\.34, 'rgb\(13,22,31\)'\);\n  g\.addColorStop\(\.66, 'rgb\(17,26,34\)'\); g\.addColorStop\(\.88, 'rgb\(24,35,42\)'\);\n  g\.addColorStop\(1, 'rgb\(14,22,28\)'\);/,
        to: () => "  THEME.sky.stops.forEach(s => g.addColorStop(s[0], s[1]));",
        expect: 1,
    },
    {
        label: "sky: the glow behind the ridge",
        find: /wg\.addColorStop\(0, 'rgba\(150,66,26,\.30\)'\); wg\.addColorStop\(\.5, 'rgba\(96,44,22,\.12\)'\);/,
        to: () => "wg.addColorStop(0, THEME.sky.glow[0]); wg.addColorStop(.5, THEME.sky.glow[1]);",
        expect: 1,
    },
    {
        label: "sky: the stars",
        find: /  for \(let i = 0; i < 420; i\+\+\) \{\n(    const sx[^\n]*\n)    x\.fillStyle = 'rgba\(214,232,240,' \+/,
        to: (_match, line) => "  for (let i = 0; i < THEME.sky.stars; i++) {\n" + line + "    x.fillStyle = THEME.sky.star +",
        expect: 1,
    },
    {
        label: "sky: the dome's tint",
        find: /new THREE\.MeshBasicMaterial\(\{ color: hdr\(\.60, \.70, \.80\), map: tx\(texSky\(\)\),/,
        to: () => "new THREE.MeshBasicMaterial({ color: hdr(...THEME.sky.tint), map: tx(texSky()),",
        expect: 1,
    },

    /* ---- the ridge: three layers, where Kage had two ---- */
    {
        label: "ridge: the silhouette ink",
        find: /x\.fillStyle = '#050809';/g,
        to: () => "x.fillStyle = THEME.ridge.ink;",
        expect: 2,
    },
    {
        /* The plate reads as three stepped hill layers receding into the
           violet; Kage's two were tuned for cedar. Each layer carries its own
           tint in the theme rather than the first-or-rest pair the source
           picked by index. */
        label: "ridge: the layers",
        find: /  \[\[-90, 13, 300, 26, 0\], \[-63, 9\.5, 210, 19, 16\]\]\.forEach\(\(r, i\) => \{/,
        to: () => "  THEME.ridge.layers.forEach((r, i) => {",
        expect: 1,
    },
    {
        label: "ridge: each layer's own tint",
        find: /        color: i \? 0x0a1015 : 0x06090d, depthWrite: false, fog: false \}\)\);/,
        to: () => "        color: r[5], depthWrite: false, fog: false }));",
        expect: 1,
    },

    /* ---- the moon: rose, larger, higher and further right ---- */
    {
        label: "moon: where it hangs, and how big",
        find: /const MOON = \{ x: 17\.9, y: 31\.9, z: -72, r: 8\.6 \};/,
        to: () => "const MOON = { x: THEME.moon.x, y: THEME.moon.y, z: THEME.moon.z, r: THEME.moon.r };",
        expect: 1,
    },
    {
        /* Blue ABOVE green. That ordering is the whole difference between a
           rose moon and a fireball, and it is written in linear because the
           map is decoded before the tint multiplies it. */
        label: "moon: the disc's tint",
        find: /color: hdr\(3\.6, \.64, \.61\),/,
        to: () => "color: hdr(...THEME.moon.hdr),",
        expect: 1,
    },
    {
        label: "moon: the corona",
        find: /new THREE\.PlaneGeometry\(MOON\.r \* 6\.4, MOON\.r \* 6\.4\),\n    new THREE\.MeshBasicMaterial\(\{ map: tx\(texGlow\('rgba\(255,124,112,\.90\)', 'rgba\(206,52,48,\.26\)'\)\),\n      transparent: true, blending: THREE\.AdditiveBlending, depthWrite: false, fog: false, opacity: \.44 \}\)\);/,
        to: () =>
            "new THREE.PlaneGeometry(MOON.r * THEME.moon.haloScale, MOON.r * THEME.moon.haloScale),\n" +
            "    new THREE.MeshBasicMaterial({ map: tx(texGlow(THEME.moon.halo[0], THEME.moon.halo[1])),\n" +
            "      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: THEME.moon.haloOpacity }));",
        expect: 1,
    },
    {
        label: "moon: the corona's breathing starts from the theme's opacity",
        find: /WORLD\.moonHalo\.material\.opacity = \.44 \+ f \* \.10/,
        to: () => "WORLD.moonHalo.material.opacity = THEME.moon.haloOpacity + f * .10",
        expect: 1,
    },

    /* ---- the cloud bands. The second generator the re-theme may add to:
       the plate has three soft bands crossing the moon, and Kage's clear
       blood moon has none. Painted like every other texture here, placed
       from the theme, and slid with the moon by placeMoon so a tall frame
       cannot leave them hanging in empty sky. ---- */
    {
        label: "clouds: the painter",
        find: /\nfunction placeMoon\(\) \{/,
        to: () =>
            "\n/* a soft band of cloud: overlapping elliptical puffs along a line,\n" +
            "   core to edge in the theme's three stops, faded out at both ends so\n" +
            "   no band shows the rectangle it is painted on */\n" +
            "function texCloud(seed) {\n" +
            "  const W = 512, H = 128, c = cvs(W, H), x = c.getContext('2d');\n" +
            "  const rnd = mulberry32(seed);\n" +
            "  for (let i = 0; i < 18; i++) {\n" +
            "    const px = W * (.08 + .84 * rnd()), py = H * (.5 + (rnd() - .5) * .30);\n" +
            "    const rx = W * (.10 + rnd() * .12), ry = H * (.22 + rnd() * .16);\n" +
            "    x.save(); x.translate(px, py); x.scale(1, ry / rx);\n" +
            "    const g = x.createRadialGradient(0, 0, 0, 0, 0, rx);\n" +
            "    g.addColorStop(0, THEME.cloud.core); g.addColorStop(.55, THEME.cloud.mid); g.addColorStop(1, THEME.cloud.edge);\n" +
            "    x.fillStyle = g; x.beginPath(); x.arc(0, 0, rx, 0, TAU); x.fill(); x.restore();\n" +
            "  }\n" +
            "  x.globalCompositeOperation = 'destination-in';\n" +
            "  const f = x.createLinearGradient(0, 0, W, 0);\n" +
            "  f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(.2, 'rgba(0,0,0,1)');\n" +
            "  f.addColorStop(.8, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)');\n" +
            "  x.fillStyle = f; x.fillRect(0, 0, W, H);\n" +
            "  return c;\n" +
            "}\n" +
            "function buildClouds() {\n" +
            "  WORLD.clouds = THEME.cloud.bands.map((b, i) => {\n" +
            "    const m = new THREE.Mesh(new THREE.PlaneGeometry(b[3], b[4]),\n" +
            "      new THREE.MeshBasicMaterial({ map: tx(texCloud(71 + i * 13)), transparent: true,\n" +
            "        depthWrite: false, fog: false, opacity: b[5] }));\n" +
            "    m.position.set(b[0], b[1], b[2]); m.renderOrder = 2;\n" +
            "    m.userData = { x0: b[0], xb: b[0], ph: i * 1.7 };\n" +
            "    scene.add(m); return m;\n" +
            "  });\n" +
            "}\n" +
            "function placeMoon() {",
        expect: 1,
    },
    {
        label: "clouds: slide with the moon on a tall frame",
        find: /  WORLD\.moonHalo\.position\.x = x;\n\}/,
        to: () =>
            "  WORLD.moonHalo.position.x = x;\n" +
            "  const k = 1 - .40 * aspectFix();\n" +
            "  if (WORLD.clouds) WORLD.clouds.forEach(m => { m.userData.x0 = m.userData.xb * k; });\n" +
            "}",
        expect: 1,
    },
    {
        label: "clouds: built with the moon",
        find: /\['Hanging the moon', \(\) => buildMoon\(\)\],/,
        to: () => "['Hanging the moon', () => { buildMoon(); buildClouds(); }],",
        expect: 1,
    },
    {
        /* They drift, slowly — the source's own note is that the moon only
           breathes and what moves is whatever is in front of it. */
        label: "clouds: the drift",
        find: /  \/\* haze slides across the courtyard \*\//,
        to: (m) =>
            "  if (WORLD.clouds) WORLD.clouds.forEach(c => { c.position.x = c.userData.x0 + Math.sin(clock * .045 + c.userData.ph) * 1.8; });\n\n" + m,
        expect: 1,
    },

    /* ---- stone and paving: violet-grey, matte ---- */
    {
        label: "stone: the wall's painted base",
        find: /x\.fillStyle = '#10161a'; x\.fillRect\(0, 0, W, H\);/,
        to: () => "x.fillStyle = THEME.stone.wallBase; x.fillRect(0, 0, W, H);",
        expect: 1,
    },
    {
        label: "stone: the wall's tint",
        find: /roughness: \.78, metalness: \.05, color: 0x525c60/,
        to: () => "roughness: .78, metalness: .05, color: THEME.stone.wallTint",
        expect: 1,
    },
    {
        label: "stone: the paving's painted base",
        find: /x\.fillStyle = '#0a0f12'; x\.fillRect\(0, 0, W, H\);/,
        to: () => "x.fillStyle = THEME.stone.floorBase; x.fillRect(0, 0, W, H);",
        expect: 1,
    },
    {
        /* Matte. Kage's paving was wet slate holding a specular; the plate
           is dry vector art and a sheen on the courtyard reads as water that
           is not there. */
        label: "stone: the paving's tint and finish",
        find: /    roughness: \.74, metalness: \.06, color: 0x69757a/,
        to: () => "    roughness: THEME.stone.floorRough, metalness: THEME.stone.floorMetal, color: THEME.stone.floorTint",
        expect: 1,
    },
    {
        label: "stone: the podium",
        find: /roughness: \.93, metalness: \.02, color: 0x58636a/,
        to: () => "roughness: .93, metalness: .02, color: THEME.stone.platTint",
        expect: 1,
    },
    {
        label: "stone: the lantern granite",
        find: /\{ color: 0x9aa5a5, metalness: 0, normal: 1\.45 \}/,
        to: () => "{ color: THEME.stone.graniteTint, metalness: 0, normal: 1.45 }",
        expect: 1,
    },
    {
        label: "stone: the boulders",
        find: /const mat = new THREE\.MeshStandardMaterial\(\{ color: 0x141a1c, roughness: \.46, metalness: \.10 \}\);/,
        to: () => "const mat = new THREE.MeshStandardMaterial({ color: THEME.stone.boulder, roughness: .46, metalness: .10 });",
        expect: 1,
    },

    /* ---- timber and tile ---- */
    {
        label: "timber: the hall's boards",
        find: /surface\(wallWood\(\), \[4, 1\.6\], \{ color: 0x565150, normal: 1\.5 \}\)/,
        to: () => "surface(wallWood(), [4, 1.6], { color: THEME.timber.hallTint, normal: 1.5 })",
        expect: 1,
    },
    {
        label: "timber: the posts",
        find: /\{ color: 0x8a746d, normal: 1\.05, metalness: \.03 \}/,
        to: () => "{ color: THEME.timber.postTint, normal: 1.05, metalness: .03 }",
        expect: 1,
    },
    {
        label: "timber: the hall's gold",
        find: /new THREE\.MeshStandardMaterial\(\{ color: 0x8f6f2e, roughness: \.38, metalness: \.78 \}\)/,
        to: () => "new THREE.MeshStandardMaterial({ color: THEME.timber.gold, roughness: .38, metalness: .78 })",
        expect: 1,
    },
    {
        label: "timber: the roof tile's tint",
        find: /\{ color: 0x2b343a, roughness: \.74, metalness: \.10, normal: 1\.4 \}/,
        to: () => "{ color: THEME.timber.tileTint, roughness: .74, metalness: .10, normal: 1.4 }",
        expect: 1,
    },
    {
        label: "timber: the roof tile's painted base",
        find: /x\.fillStyle = '#151c20'; x\.fillRect\(0, 0, W, H\);/,
        to: () => "x.fillStyle = THEME.timber.tileBase; x.fillRect(0, 0, W, H);",
        expect: 1,
    },
    {
        label: "timber: the tile ribs catch violet, not teal",
        find: /x\.fillStyle = 'rgba\(168,196,208,\.09\)';/,
        to: () => "x.fillStyle = THEME.timber.tileRib;",
        expect: 1,
    },

    /* ---- the gate ---- */
    {
        label: "torii: the lacquer",
        find: /x\.globalAlpha = \.80; x\.fillStyle = '#7c1610';/,
        to: () => "x.globalAlpha = .80; x.fillStyle = THEME.torii.coat;",
        expect: 1,
    },
    {
        label: "torii: the lacquer's lift",
        find: /\{ color: hdr\(1\.72, 1\.02, \.94\), roughness: \.92, metalness: \.05, normal: \.75 \}/,
        to: () => "{ color: hdr(...THEME.torii.hdr), roughness: .92, metalness: .05, normal: .75 }",
        expect: 1,
    },
    {
        label: "torii: the gold",
        find: /const gold = new THREE\.MeshStandardMaterial\(\{ color: 0x7a5d2a, roughness: \.50, metalness: \.60 \}\);/,
        to: () => "const gold = new THREE.MeshStandardMaterial({ color: THEME.torii.gold, roughness: .50, metalness: .60 });",
        expect: 1,
    },
    {
        label: "torii: the cap",
        find: /new THREE\.MeshStandardMaterial\(\{ color: 0x120c0c, roughness: \.42, metalness: \.14 \}\)\);\n  cap\.position/,
        to: () => "new THREE.MeshStandardMaterial({ color: THEME.torii.cap, roughness: .42, metalness: .14 }));\n  cap.position",
        expect: 1,
    },
    {
        /* Larger and nearer: in the plate the gate is the foreground subject
           and the hall sits framed inside it. */
        label: "torii: its size and place",
        find: /  const GS = \.72;\n  g\.position\.set\(0, -BASE \* GS, -8\.6\); g\.scale\.setScalar\(GS\);/,
        to: () => "  const GS = THEME.torii.scale;\n  g.position.set(0, -BASE * GS, THEME.torii.z); g.scale.setScalar(GS);",
        expect: 1,
    },

    /* ---- the one warm accent ---- */
    {
        label: "ember: the shoji bays",
        find: /const paper = new THREE\.MeshBasicMaterial\(\{ color: hdr\(1\.06, \.48, \.18\),/,
        to: () => "const paper = new THREE.MeshBasicMaterial({ color: hdr(...THEME.ember.paperHdr),",
        expect: 1,
    },
    {
        label: "ember: the lantern panes",
        find: /const paneMat = new THREE\.MeshBasicMaterial\(\{ color: hdr\(2\.3, \.30, \.085\),/,
        to: () => "const paneMat = new THREE.MeshBasicMaterial({ color: hdr(...THEME.ember.lanternHdr),",
        expect: 1,
    },
    {
        label: "ember: the lantern glow",
        find: /texGlow\('rgba\(255,120,60,\.9\)', 'rgba\(255,60,24,\.28\)'\)/,
        to: () => "texGlow(THEME.ember.lanternGlow[0], THEME.ember.lanternGlow[1])",
        expect: 1,
    },
    {
        label: "ember: the hall's glow",
        find: /texGlow\('rgba\(255,150,66,\.80\)', 'rgba\(240,96,26,\.24\)'\)/,
        to: () => "texGlow(THEME.ember.hallGlow[0], THEME.ember.hallGlow[1])",
        expect: 1,
    },
    {
        label: "ember: the motes' sprite",
        find: /texGlow\('rgba\(255,190,140,1\)', 'rgba\(255,120,60,\.35\)'\)/,
        to: () => "texGlow(THEME.ember.motes[0], THEME.ember.motes[1])",
        expect: 1,
    },
    {
        label: "ember: the motes' colour in the shader",
        find: /gl_FragColor = vec4\(t\.rgb\*vec3\(1\.6,0\.78,0\.42\), t\.a\*vA\*0\.75\); \}'/,
        to: () => "gl_FragColor = vec4(t.rgb*' + glv3(THEME.ember.moteRgb) + ', t.a*vA*0.75); }'",
        expect: 1,
    },

    /* ---- mist and haze: violet, not the sea-glass of Kage ---- */
    {
        label: "haze: the drifting slabs",
        find: /texGlow\('rgba\(160,205,210,\.55\)', 'rgba\(110,165,175,\.18\)'\)/,
        to: () => "texGlow(THEME.weather.hazeGlow[0], THEME.weather.hazeGlow[1])",
        expect: 1,
    },
    {
        label: "haze: how much of it",
        find: /depthWrite: false, fog: false, opacity: \.05 \+ rnd\(\) \* \.07 \}\)\);/,
        to: () => "depthWrite: false, fog: false, opacity: THEME.weather.hazeOpacity[0] + rnd() * THEME.weather.hazeOpacity[1] }));",
        expect: 1,
    },
    {
        label: "haze: the band behind the hall",
        find: /texGlow\('rgba\(150,178,190,\.62\)', 'rgba\(104,138,154,\.20\)'\)/,
        to: () => "texGlow(THEME.weather.hazeGlow[0], THEME.weather.hazeGlow[1])",
        expect: 1,
    },

    /* ---- the ground cover ---- */
    {
        label: "foliage: the grass plates' body",
        find: /bg\.addColorStop\(0, '#1a2416'\); bg\.addColorStop\(\.38, '#0e150c'\); bg\.addColorStop\(1, '#040604'\);/,
        to: () => "bg.addColorStop(0, THEME.foliage.grassTop); bg.addColorStop(.38, THEME.foliage.grassMid); bg.addColorStop(1, THEME.foliage.grassBase);",
        expect: 1,
    },
    {
        /* Kage lit its grass from below with ember red, off the lanterns.
           Here that bounce is rose — the moon's — because red on the ground
           would be the second warm hue the plate does not have. */
        label: "foliage: the bounce off the moon",
        find: /rb\.addColorStop\(0, 'rgba\(180,40,16,\.24\)'\); rb\.addColorStop\(\.55, 'rgba\(140,32,14,\.07\)'\);/,
        to: () => "rb.addColorStop(0, THEME.foliage.bounce); rb.addColorStop(.55, 'rgba(0,0,0,0)');",
        expect: 1,
    },
    {
        label: "foliage: the sky's lick on the crests",
        find: /sk\.addColorStop\(0, 'rgba\(146,182,180,\.13\)'\);/,
        to: () => "sk.addColorStop(0, THEME.foliage.skyLick);",
        expect: 1,
    },
    {
        label: "foliage: blades pulled toward violet",
        find: /\* \(opt\.tintR \|\| 1\);\n    const g = \(16 \+ 106 \* l \+ 24 \* warm\) \* \(opt\.tintG \|\| 1\);\n    const bl = \(12 \+ 80 \* l \+ 16 \* warm\) \* \(opt\.tintB \|\| 1\);/,
        to: () =>
            "* (opt.tintR || THEME.foliage.tintR);\n" +
            "    const g = (16 + 106 * l + 24 * warm) * (opt.tintG || THEME.foliage.tintG);\n" +
            "    const bl = (12 + 80 * l + 16 * warm) * (opt.tintB || THEME.foliage.tintB);",
        expect: 1,
    },
    {
        label: "foliage: the rocks' lit edge",
        find: /x\.strokeStyle = 'rgba\(178,206,206,\.20\)';/,
        to: () => "x.strokeStyle = THEME.foliage.rockLit;",
        expect: 1,
    },
    {
        label: "foliage: the rocks' bounce",
        find: /rb\.addColorStop\(0, 'rgba\(190,48,22,\.16\)'\);/,
        to: () => "rb.addColorStop(0, THEME.foliage.bounce);",
        expect: 1,
    },

    /* ---- the cursor wisps ---- */
    {
        label: "wisps: the trail's stops",
        find: /  g\.addColorStop\(0,   'rgba\(255,255,255,1\)'\);[^\n]*\n  g\.addColorStop\(\.07, 'rgba\(236,250,250,\.92\)'\);\n  g\.addColorStop\(\.16, 'rgba\(190,230,238,\.40\)'\);\n  g\.addColorStop\(\.34, 'rgba\(132,192,212,\.13\)'\);\n  g\.addColorStop\(\.62, 'rgba\(88,146,172,\.035\)'\);\n  g\.addColorStop\(1,   'rgba\(70,120,142,0\)'\);/,
        to: () => "  THEME.wisp.stops.forEach(s => g.addColorStop(s[0], s[1]));",
        expect: 1,
    },

    /* ---- the grade. Kage graded shadows toward teal and pivoted a
       neutral contrast curve at 0.30. This plate's shadows are violet, its
       highs barely warm, and it is flatter — pivot 0.42, gain 0.94 —
       because it is vector-flat illustration and a film grade fights it. ---- */
    {
        label: "grade: violet shadows",
        find: /' c = mix\(c, c\*vec3\(0\.74,1\.03,1\.11\), smoothstep\(0\.55,0\.0,l\)\*0\.80\);\\n' \+/,
        to: () => "' c = mix(c, c*' + glv3(THEME.post.shadowTint) + ', smoothstep(0.55,0.0,l)*' + glf(THEME.post.shadowAmt) + ');\\n' +",
        expect: 1,
    },
    {
        label: "grade: the highs",
        find: /' c = mix\(c, c\*vec3\(1\.035,0\.995,0\.968\), smoothstep\(0\.50,1\.0,l\)\*0\.26\);\\n' \+/,
        to: () => "' c = mix(c, c*' + glv3(THEME.post.highTint) + ', smoothstep(0.50,1.0,l)*' + glf(THEME.post.highAmt) + ');\\n' +",
        expect: 1,
    },
    {
        label: "grade: the contrast curve",
        find: /' e = clamp\(\(e - 0\.30\) \* 1\.00 \+ 0\.30, 0\.0, 1\.0\);\\n' \+/,
        to: () => "' e = clamp((e - ' + glf(THEME.post.pivot) + ') * ' + glf(THEME.post.contrast) + ' + ' + glf(THEME.post.pivot) + ', 0.0, 1.0);\\n' +",
        expect: 1,
    },
    {
        label: "camera: the waypoints come from the theme",
        find: /const CAM = \[\n(?:.*\n){6}\];/,
        to: () =>
            "/* THE WAYPOINTS ARE THE THEME'S, not Kage's. Same six-stop rig and\n" +
            "   the same curve through it; only where it stands and what it looks\n" +
            "   at differ, because this composition puts the gate in the\n" +
            "   foreground and the moon higher and further right. */\n" +
            "const CAM = THEME.cam;",
        expect: 1,
    },
];

/* ---- the foreground pass ----------------------------------------------
   WHY A SECOND CANVAS AT ALL. The contact form sits IN this world, with
   the nearest grass passing in front of its lower edge. The world is one
   opaque canvas, and a canvas is one composited element: no z-index, no
   renderOrder and no three.js layer can put an HTML form between two
   things drawn into it. So the few plates nearest the lens are lifted out
   and drawn into a second, transparent canvas that the host stacks above
   the form.

   WHICH PLATES, by depth rather than by look. grassNear (z 5.6) is the
   grass that crosses the form — but rockNear (6.0) and the bough (6.4)
   are NEARER, and on screen rockNear overlaps grassNear. Lift the grass
   alone and it would be painted over a rock that stands in front of it.
   So the set is everything from grassNear forward. Nothing further back
   is lifted, and nothing is duplicated: a plate is in exactly one pass.

   WHAT IS SHARED, AND WHAT IS NOT. One scene, one camera, one clock and
   one per-frame update drive both canvases — this is a second render of
   the same frame, not a second world. The foreground gets its own
   composite rather than the full bloom chain (a few grass edges do not
   need sixteen passes), but that composite runs the SAME grade — exposure,
   ACES, saturation, the violet shadow tint, the highs, vignette, grain,
   the contrast curve — so a blade does not change colour as it crosses
   from one canvas into the other. The grade is non-linear, so it is run on
   UN-premultiplied colour and premultiplied again on the way out; skipping
   that is what gives transparent foliage black fringes.

   Everything here is opt-in: without a foreground canvas from the host,
   the module renders exactly as it did before. */
const FOREGROUND = [
    {
        label: "the factory accepts a foreground canvas",
        find: /export function createTempleNightRenderer\(canvas\) \{\n'use strict';/,
        to: () =>
            "export function createTempleNightRenderer(canvas, opts) {\n'use strict';\n" +
            "/* Optional. When the host supplies it, the nearest plates are drawn\n" +
            "   into it instead of into the world, so an HTML layer can sit between. */\n" +
            "const fgCanvas = (opts && opts.foregroundCanvas) || null;",
        expect: 1,
    },
    {
        label: "the foreground's own state",
        find: /const POST = \{ levels: \[\] \};/,
        to: (m) =>
            m + "\n" +
            "/* Layer 3 is unused by the world (1 is 'near the lens', 2 was the\n" +
            "   wordmark), so the base camera — which enables 0, 1 and 2 — already\n" +
            "   skips it. Moving a plate here is all it takes to lift it out. */\n" +
            "const FG_LAYER = 3;\n" +
            "const FG_NAMES = ['grassNear', 'rockNear', 'bough'];\n" +
            "const FG = { renderer: null, target: null, mat: null, meshes: [], enabled: true, probe: null };",
        expect: 1,
    },
    {
        /* Same pixel ratio, same size, linear output, no tone mapping — the
           composite below does all of that, exactly as the base's does. */
        label: "the foreground renderer",
        find: /  renderer\.setClearColor\(THEME\.air\.clear, 1\);\n/,
        to: (m) =>
            m +
            "  if (fgCanvas && WANT_POST) {\n" +
            "    FG.renderer = new THREE.WebGLRenderer({ canvas: fgCanvas, antialias: false, alpha: true,\n" +
            "      premultipliedAlpha: true, powerPreference: 'high-performance' });\n" +
            "    FG.renderer.setPixelRatio(renderer.getPixelRatio());\n" +
            "    FG.renderer.setSize(vpW(), vpH(), true);\n" +
            "    FG.renderer.outputEncoding = THREE.LinearEncoding;\n" +
            "    FG.renderer.toneMapping = THREE.NoToneMapping;\n" +
            "    FG.renderer.setClearColor(0x000000, 0);\n" +
            "  }\n",
        expect: 1,
    },
    {
        label: "the foreground composite and the lift",
        find: /\nfunction renderPost\(\) \{/,
        to: (m) =>
            "\nfunction initForeground() {\n" +
            "  if (!FG.renderer || !POST.scene) return;\n" +
            "  FG.meshes = WORLD.fg.filter(m => FG_NAMES.indexOf(m.name) >= 0);\n" +
            "  FG.meshes.forEach(m => m.layers.set(FG_LAYER));\n" +
            "  const w = renderer.domElement.width, h = renderer.domElement.height;\n" +
            "  FG.target = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,\n" +
            "    type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false, samples: LOW ? 0 : 2 });\n" +
            "  FG.mat = new THREE.ShaderMaterial({\n" +
            "    uniforms: {\n" +
            "      tS: { value: null }, uRes: { value: new THREE.Vector2(w, h) }, uT: { value: 0 }, uFade: { value: 1 },\n" +
            "      uGrain: { value: THEME.post.grain }, uVig: { value: THEME.post.vignette },\n" +
            "      uExp: { value: THEME.post.exposure }, uSat: { value: THEME.post.saturation }\n" +
            "    },\n" +
            "    vertexShader: QUAD_VS,\n" +
            "    fragmentShader:\n" +
            "      'uniform sampler2D tS; uniform vec2 uRes; uniform float uT, uFade, uGrain, uVig, uExp, uSat;\\n' +\n" +
            "      'varying vec2 vUv;\\n' +\n" +
            "      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }\\n' +\n" +
            "      'void main(){\\n' +\n" +
            "      ' vec4 s = texture2D(tS, vUv);\\n' +\n" +
            "      ' float a = clamp(s.a, 0.0, 1.0);\\n' +\n" +
            "      ' if (a < 0.003) { gl_FragColor = vec4(0.0); return; }\\n' +\n" +
            "      ' vec3 c = s.rgb / a;\\n' +\n" +
            "      ' vec2 d = vUv - 0.5;\\n' +\n" +
            "      ' c *= uExp;\\n' +\n" +
            "      ' c = aces(c);\\n' +\n" +
            "      ' float l = dot(c, vec3(0.2126,0.7152,0.0722));\\n' +\n" +
            "      ' c = mix(vec3(l), c, uSat);\\n' +\n" +
            "      ' c = mix(c, c*' + glv3(THEME.post.shadowTint) + ', smoothstep(0.55,0.0,l)*' + glf(THEME.post.shadowAmt) + ');\\n' +\n" +
            "      ' c = mix(c, c*' + glv3(THEME.post.highTint) + ', smoothstep(0.50,1.0,l)*' + glf(THEME.post.highAmt) + ');\\n' +\n" +
            "      ' float v = smoothstep(1.22, 0.26, length(d*vec2(1.0,0.94))*1.42);\\n' +\n" +
            "      ' c *= mix(1.0, v, uVig);\\n' +\n" +
            "      ' float g = fract(sin(dot(vUv*uRes + uT*137.0, vec2(12.9898,78.233)))*43758.5453);\\n' +\n" +
            "      ' c += (g-0.5)*uGrain;\\n' +\n" +
            "      ' c *= uFade;\\n' +\n" +
            "      ' vec3 e = pow(max(c,0.0), vec3(1.0/2.2));\\n' +\n" +
            "      ' e = clamp((e - ' + glf(THEME.post.pivot) + ') * ' + glf(THEME.post.contrast) + ' + ' + glf(THEME.post.pivot) + ', 0.0, 1.0);\\n' +\n" +
            "      ' gl_FragColor = vec4(e * a, a);\\n' +\n" +
            "      '}',\n" +
            "    blending: THREE.NoBlending, depthTest: false, depthWrite: false\n" +
            "  });\n" +
            "}\n" +
            "/* Draws the lifted plates, then grades them onto the transparent\n" +
            "   canvas. Called from render(), after the base frame, so both come\n" +
            "   from the same update and the same instant of sway. */\n" +
            "/* The lift can be switched off at runtime — the host does so on narrow\n" +
            "   screens, where there is no room for the grass to cross a panel\n" +
            "   without reaching its controls. Off, the plates simply go back into\n" +
            "   the world's own pass, so the frame is exactly the original one. */\n" +
            "function setForegroundLift(on) {\n" +
            "  on = !!on;\n" +
            "  if (!FG.target || FG.enabled === on) return;\n" +
            "  FG.enabled = on;\n" +
            "  FG.meshes.forEach(m => m.layers.set(on ? FG_LAYER : 1));\n" +
            "  if (!on) {\n" +
            "    FG.renderer.setRenderTarget(null);\n" +
            "    FG.renderer.setClearColor(0x000000, 0);\n" +
            "    FG.renderer.clear(true, true, false);\n" +
            "  }\n" +
            "}\n" +
            "/* WHERE THE GRASS ACTUALLY IS, for the page to place its content by.\n" +
            "   The lifted plates rendered once into a small target and read back:\n" +
            "   for each column, the highest opaque row, in the canvas's own CSS\n" +
            "   pixels. Measured rather than derived, because the crest's height on\n" +
            "   screen depends on the painted silhouette, the plate's depth and the\n" +
            "   camera's aspect-dependent framing all at once.\n" +
            "   readPixels stalls the pipeline, so this is for the host to call on\n" +
            "   settle — after a resize, on becoming visible — never per frame. The\n" +
            "   threshold is low on purpose: a thin blade tip, averaged down into a\n" +
            "   256-column target, keeps only a fraction of its alpha, and missing\n" +
            "   it would report the grass lower than it is. */\n" +
            "function measureForeground() {\n" +
            "  if (!FG.target || !FG.enabled) return null;\n" +
            "  const cw = vpW(), ch = vpH();\n" +
            "  const sw = 256, sh = Math.max(32, Math.round(sw * ch / cw));\n" +
            "  if (!FG.probe || FG.probe.width !== sw || FG.probe.height !== sh) {\n" +
            "    if (FG.probe) FG.probe.dispose();\n" +
            "    FG.probe = new THREE.WebGLRenderTarget(sw, sh, { depthBuffer: true, stencilBuffer: false });\n" +
            "  }\n" +
            "  const mask = camera.layers.mask, bg = scene.background;\n" +
            "  camera.layers.set(FG_LAYER);\n" +
            "  scene.background = null;\n" +
            "  FG.renderer.setRenderTarget(FG.probe);\n" +
            "  FG.renderer.setClearColor(0x000000, 0);\n" +
            "  FG.renderer.clear(true, true, false);\n" +
            "  FG.renderer.render(scene, camera);\n" +
            "  camera.layers.mask = mask;\n" +
            "  scene.background = bg;\n" +
            "  const buf = new Uint8Array(sw * sh * 4);\n" +
            "  FG.renderer.readRenderTargetPixels(FG.probe, 0, 0, sw, sh, buf);\n" +
            "  FG.renderer.setRenderTarget(null);\n" +
            "  const top = new Array(sw);\n" +
            "  for (let x = 0; x < sw; x++) {\n" +
            "    top[x] = ch;\n" +
            "    /* readPixels counts rows from the BOTTOM */\n" +
            "    for (let row = sh - 1; row >= 0; row--) {\n" +
            "      if (buf[(row * sw + x) * 4 + 3] > 20) { top[x] = (sh - 1 - row) / sh * ch; break; }\n" +
            "    }\n" +
            "  }\n" +
            "  return { width: cw, height: ch, top: top };\n" +
            "}\n" +
            "function renderForeground() {\n" +
            "  if (!FG.target || !FG.enabled) return;\n" +
            "  const mask = camera.layers.mask, bg = scene.background;\n" +
            "  camera.layers.set(FG_LAYER);\n" +
            "  scene.background = null;                 /* or the clear would be opaque */\n" +
            "  FG.renderer.setRenderTarget(FG.target);\n" +
            "  FG.renderer.setClearColor(0x000000, 0);\n" +
            "  FG.renderer.clear(true, true, false);\n" +
            "  FG.renderer.render(scene, camera);\n" +
            "  camera.layers.mask = mask;\n" +
            "  scene.background = bg;\n" +
            "  FG.mat.uniforms.tS.value = FG.target.texture;\n" +
            "  FG.mat.uniforms.uT.value = clock;\n" +
            "  FG.mat.uniforms.uFade.value = fadeIn;\n" +
            "  POST.quad.material = FG.mat;\n" +
            "  FG.renderer.setRenderTarget(null);\n" +
            "  FG.renderer.clear(true, false, false);\n" +
            "  FG.renderer.render(POST.qScene, POST.cam);\n" +
            "}\n" + m,
        expect: 1,
    },
    {
        /* After the job that assigns every plate to layer 1, or that
           assignment would put the lifted ones straight back. */
        label: "the lift happens after the plates' own layer assignment",
        find: /    WORLD\.fg\.forEach\(m => m\.layers\.set\(1\)\);\n/,
        to: (m) => m + "    initForeground();\n",
        expect: 1,
    },
    {
        label: "each frame draws the foreground after the base",
        find: /    POST\.comp\.uniforms\.uFade\.value = fadeIn;\n    renderPost\(\);\n  \}\n\}/,
        to: () =>
            "    POST.comp.uniforms.uFade.value = fadeIn;\n    renderPost();\n  }\n  renderForeground();\n}",
        expect: 1,
    },
    {
        label: "resize keeps the two canvases identical",
        find: /  if \(WANT_SHADOW && WORLD\.key\) WORLD\.key\.shadow\.needsUpdate = true;\n/,
        to: (m) =>
            "  if (FG.renderer) {\n" +
            "    FG.renderer.setPixelRatio(renderer.getPixelRatio());\n" +
            "    FG.renderer.setSize(w, h, true);\n" +
            "    if (FG.target) {\n" +
            "      FG.target.setSize(pw, ph);\n" +
            "      FG.mat.uniforms.uRes.value.set(pw, ph);\n" +
            "      const wantFg = POST.scene ? POST.scene.samples : 0;\n" +
            "      if (FG.target.samples !== wantFg) { FG.target.samples = wantFg; FG.target.dispose(); }\n" +
            "    }\n" +
            "  }\n" + m,
        expect: 1,
    },
];

const BOOT_MARK = "function boot() {";

const MODULE_TAIL = `/* ---- the module boundary -------------------------------------------

   What the page did here — a preloader bar, its own resize and visibility
   listeners, a ?shot= review mode, window globals — belongs to the host
   now. What is left is the part actually about the world: run the build
   jobs, size once, start the intro clock, and hand back a handle.

   The jobs run synchronously rather than spread across timeouts. The page
   stepped them so its progress bar could animate; there is no bar here,
   and a scene half-built when the first frame lands is a scene that
   flickers. */
  for (let i = 0; i < JOBS.length; i++) {
    try {
      JOBS[i][1]();
    } catch (err) {
      throw new Error('temple-night: "' + JOBS[i][0] + '" failed \\u2014 ' + (err && err.message || err));
    }
  }

  resize();
  running = true;
  tPrev = performance.now();
  /* Reduced motion starts with the intro already finished: the camera ease
     and the fade are motion; the frame behind them is not. */
  INTRO.t0 = REDUCE ? performance.now() - 4000 : performance.now();

  let disposed = false;

  return {
    reducedMotion: REDUCE,

    render(now) {
      if (disposed) return;
      frame(now);
    },

    resize() {
      if (!disposed) resize();
    },

    /* x and y arrive as normalised device coordinates over the canvas —
       what the authored pointer listener computed from the window. Leaving
       re-centres rather than freezing, so the parallax eases home instead
       of stopping mid-lean. */
    setPointer(x, y, inside = true) {
      if (disposed) return;
      RIG.tmx = inside ? x : 0;
      RIG.tmy = inside ? y : 0;
    },

    /* The near-garden split, for hosts that asked for one. */
    setForegroundLift(on) {
      if (!disposed) setForegroundLift(on);
    },
    measureForeground() {
      return disposed ? null : measureForeground();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;

      /* Everything the GPU holds, in the order it can be released: the post
         chain's targets, then the scene graph, then the context. A context
         that is not explicitly lost can outlive its canvas and still count
         against the browser's per-page limit — not theoretical on a page
         that already runs two others. */
      if (POST.scene) POST.scene.dispose();
      if (POST.levels) POST.levels.forEach(L => { L.a.dispose(); L.b.dispose(); });
      [POST.bright, POST.blur, POST.up, POST.comp].forEach(m => { if (m) m.dispose(); });
      if (POST.quad && POST.quad.geometry) POST.quad.geometry.dispose();

      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        mats.forEach(m => {
          for (const k in m) {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        });
      });
      scene.clear();

      /* Shared resources were freed once, above — disposing a geometry or
         texture notifies every renderer that uploaded it. What is left is
         each renderer's own: its targets, its programs, its context. */
      if (FG.target) FG.target.dispose();
      if (FG.probe) FG.probe.dispose();
      if (FG.mat) FG.mat.dispose();
      if (FG.renderer) { FG.renderer.dispose(); FG.renderer.forceContextLoss(); }

      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
`;

/* ---- the gate --------------------------------------------------------
   A page script with its page removed still parses. It fails on the first
   frame, inside a rAF callback, with a ReferenceError nobody sees — which
   is exactly how buildLights went missing without a word.

   So before anything is written: every identifier that is CALLED and never
   defined. Method calls are excluded by the lookbehind; keywords and real
   globals are listed. Anything left is a function the page owned and the
   world still wants. */
const GLOBALS = new Set([
    "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Promise",
    "Set", "Map", "WeakMap", "Float32Array", "Uint8Array", "Uint16Array",
    "Int32Array", "Uint32Array", "parseInt", "parseFloat", "isNaN", "isFinite",
    "requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "addEventListener", "removeEventListener",
    "matchMedia", "getComputedStyle", "performance", "console", "Image", "Date",
    "RegExp", "Error", "THREE", "THEME", "URLSearchParams", "devicePixelRatio",
    "createTempleNightRenderer",
]);
const KEYWORDS = new Set([
    "if", "for", "while", "switch", "catch", "return", "typeof", "new", "delete",
    "void", "in", "of", "do", "else", "try", "throw", "case", "function", "await",
]);

function undefinedCallables(src) {
    const bare = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/`[\s\S]*?`/g, "``");

    const defined = new Set();
    for (const m of bare.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
    for (const m of bare.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
    /* Object-literal method shorthand — `setPointer(x, y) {` — which is how
       the returned handle declares its own methods. Without this the gate
       reports the module's own API as missing. Control-flow keywords match
       this shape too and land in `defined` harmlessly; they are skipped on
       the lookup side anyway. */
    for (const m of bare.matchAll(/^\s{2,}([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/gm)) defined.add(m[1]);

    const missing = new Map();
    for (const m of bare.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/gm)) {
        const n = m[2];
        if (defined.has(n) || GLOBALS.has(n) || KEYWORDS.has(n)) continue;
        missing.set(n, (missing.get(n) || 0) + 1);
    }
    return [...missing].sort((a, b) => b[1] - a[1]);
}

/* ---- resilience -----------------------------------------------------
   A browser hands out graphics contexts grudgingly, and the authored page
   assumed otherwise: it asks for one, and if the answer is no, three turns
   the null into "Error creating WebGL context" and the section is dead for
   the life of the page. Two refusals are routine rather than exotic:

     - a laptop whose discrete GPU is parked refuses powerPreference
       'high-performance' outright, while a plain context would be granted;
     - a page already holding several contexts (this site runs the dock's
       effect and the projects world too, and React's development double
       mount briefly doubles every one of them) is refused until the
       browser reclaims one.

   So each request is retried on humbler terms, and the near garden — which
   is an enhancement, not the section — is allowed to fail on its own
   without taking the world with it. These edits are applied last, so the
   foreground renderer they rewrite is already in place. */
const RESILIENCE = [
    {
        label: "the retrying context request",
        find: /\nfunction initGL\(\) \{/,
        to: (m) =>
            "\n/* Returns null instead of throwing when every attempt is refused;\n" +
            "   callers decide whether that is fatal. Retrying on the same canvas is\n" +
            "   safe precisely because nothing was created: a canvas only becomes\n" +
            "   unusable once a context has been attached to it. */\n" +
            "function glRenderer(params) {\n" +
            "  const ladder = [params,\n" +
            "    Object.assign({}, params, { powerPreference: 'default' }),\n" +
            "    Object.assign({}, params, { powerPreference: 'default', antialias: false })];\n" +
            "  for (let i = 0; i < ladder.length; i++) {\n" +
            "    try { return new THREE.WebGLRenderer(ladder[i]); } catch (e) { /* next rung */ }\n" +
            "  }\n" +
            "  return null;\n" +
            "}" + m,
        expect: 1,
    },
    {
        label: "the world's context, asked for politely",
        find: /  renderer = new THREE\.WebGLRenderer\(\{ canvas: canvas, antialias: !WANT_POST, alpha: false, powerPreference: 'high-performance' \}\);\n/,
        to: () =>
            "  renderer = glRenderer({ canvas: canvas, antialias: !WANT_POST, alpha: false, powerPreference: 'high-performance' });\n" +
            "  /* Worth distinguishing from 'this browser has no WebGL': the host\n" +
            "     can try again later, because contexts come back as other things\n" +
            "     on the page let theirs go. */\n" +
            "  if (!renderer) { const e = new Error('no graphics context available'); e.retryable = true; throw e; }\n",
        expect: 1,
    },
    {
        label: "the near garden's context, which may fail alone",
        find: /    FG\.renderer = new THREE\.WebGLRenderer\(\{ canvas: fgCanvas, antialias: false, alpha: true,\n      premultipliedAlpha: true, powerPreference: 'high-performance' \}\);\n/,
        to: () =>
            "    /* No second context, no lift: initForeground bails on a null\n" +
            "       renderer, the plates stay on layer 1, and the world draws its\n" +
            "       own grass exactly as it did before any of this. */\n" +
            "    FG.renderer = glRenderer({ canvas: fgCanvas, antialias: false, alpha: true,\n" +
            "      premultipliedAlpha: true, powerPreference: 'high-performance' });\n" +
            "  }\n" +
            "  if (FG.renderer) {\n",
        expect: 1,
    },
];

/* ---- run ------------------------------------------------------------ */

if (!existsSync(SOURCE)) {
    console.error(`missing: ${SOURCE}\nVendor it from node_modules/@designcodeio/threeui first.`);
    process.exit(1);
}

const html = readFileSync(SOURCE, "utf8");
const script = isolateScript(html);
const { out: kept, dropped } = splitRegions(script);
let world = applySubDrops(kept);

let applied = 0;
for (const e of STRUCTURE) {
    const hits = world.match(new RegExp(e.find.source, e.find.flags.replace("g", "") + "g")) ?? [];
    if (hits.length !== e.expect) {
        console.error(
            `EDIT FAILED: "${e.label}" matched ${hits.length} times, expected ${e.expect}.\n` +
            "The authored source has changed. Re-locate it before shipping.",
        );
        process.exit(1);
    }
    world = world.replace(e.find, e.to);
    applied += 1;
}

let themed = 0;
for (const e of THEMING) {
    const hits = world.match(new RegExp(e.find.source, e.find.flags.replace("g", "") + "g")) ?? [];
    if (hits.length !== e.expect) {
        console.error(
            `THEME EDIT FAILED: "${e.label}" matched ${hits.length} times, expected ${e.expect}.\n` +
            "A colour that quietly fails to be replaced looks like a design decision, not a bug.",
        );
        process.exit(1);
    }
    world = world.replace(e.find, e.to);
    themed += 1;
}

let lifted = 0;
for (const e of FOREGROUND) {
    const hits = world.match(new RegExp(e.find.source, e.find.flags.replace("g", "") + "g")) ?? [];
    if (hits.length !== e.expect) {
        console.error(`FOREGROUND EDIT FAILED: "${e.label}" matched ${hits.length} times, expected ${e.expect}.`);
        process.exit(1);
    }
    world = world.replace(e.find, e.to);
    lifted += 1;
}

let hardened = 0;
for (const e of RESILIENCE) {
    const hits = world.match(new RegExp(e.find.source, e.find.flags.replace("g", "") + "g")) ?? [];
    if (hits.length !== e.expect) {
        console.error(`RESILIENCE EDIT FAILED: "${e.label}" matched ${hits.length} times, expected ${e.expect}.`);
        process.exit(1);
    }
    world = world.replace(e.find, e.to);
    hardened += 1;
}

const bootAt = world.indexOf(BOOT_MARK);
if (bootAt < 0) {
    console.error(`BOOT TAIL LOST: expected "${BOOT_MARK}".`);
    process.exit(1);
}
world = world.slice(0, bootAt) + MODULE_TAIL;

const missing = undefinedCallables(world);
if (missing.length) {
    console.error("UNDEFINED CALLABLES — the world calls these and nothing defines them:");
    for (const [n, c] of missing) console.error(`  ${n.padEnd(22)} x${c}`);
    console.error("\nEither a region that is world code was dropped, or a page call site survived.");
    process.exit(1);
}

/* Parses as a module? The GLSL inside is only a string to JavaScript, so
   this catches structure rather than shader syntax — but structure is what
   the edits above can break. */
try {
    new Function(world.replace(/^import .*$/gm, "").replace(/^export /m, ""));
} catch (err) {
    console.error(`DERIVED MODULE DOES NOT PARSE:\n  ${err.message}`);
    process.exit(1);
}

mkdirSync(dirname(DERIVED), { recursive: true });
writeFileSync(DERIVED, world, "utf8");

const sha = (s) => createHash("sha256").update(s).digest("hex");
console.log(`applied ${applied}/${STRUCTURE.length} structural + ${themed}/${THEMING.length} theme + ${lifted}/${FOREGROUND.length} foreground + ${hardened}/${RESILIENCE.length} resilience edits; no undefined callables; parses`);
console.log(`world ${(script.length / 1024).toFixed(0)} KB -> module ${(world.length / 1024).toFixed(0)} KB`);
console.log(`dropped ${dropped.length} page regions: ${dropped.join(", ")}`);
console.log(`\nsource  kage.html                ${sha(html).slice(0, 32)}…`);
console.log(`derived templeNightRenderer.js   ${sha(world).slice(0, 32)}…`);
