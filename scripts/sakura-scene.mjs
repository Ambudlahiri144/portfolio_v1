/* ==================================================================
   THE DERIVED SAKURA PRESENTATION

   Reads the canonical Sylva Living World source and writes a derived
   copy retinted to the Sakura reference, plus the string modules the
   React host needs.

   Run: node scripts/sakura-scene.mjs

   canonical  src/shaders/sylva-living-world/sources/inner-green-3d.html
   derived    src/shaders/sylva-living-world/sources/inner-sakura-portfolio.html
   modules    .../inner-sakura-portfolio.html.ts  and  .../three.min.js.ts

   ------------------------------------------------------------------
   WHY A SCRIPT RATHER THAN A HAND-EDITED FILE.

   Every difference from the canonical source is one entry in EDITS
   below, named and counted. The derived file can be regenerated from
   the canonical one at any time, the diff is a list you can read, and
   an edit that stops matching its source fails loudly instead of
   silently doing nothing.

   ------------------------------------------------------------------
   WHAT THIS IS NOT.

   There is NO Sakura variant in @designcodeio/threeui@1.2.0. Its
   SYLVA_LIVING_WORLD_VARIANTS is readonly ["living-green"] — one entry.
   The `variant` prop is declared in the types and never destructured by
   the component, so passing it does nothing. The word "sakura" appears
   once in the whole 195 KB source, in a comment crediting
   `sakura-branch-hero` as where the butterfly was lifted from; that is
   a different product and is not shipped here.

   So this is a retint of living-green, and it is approximate by
   construction. The composition already matches the reference — a thick
   mossy bough rising diagonally from lower-left, supporting boughs at
   the lower edge, open space above — but the reference's dense pink
   blossom clusters are this scene's MOSS, recoloured. That is a
   reinterpretation, not a variant switch, and it should be described
   that way.

   ------------------------------------------------------------------
   HOW THE RETINT WORKS, and why not by substituting hex values.

   Every colour below keeps the ORIGINAL's luminance and takes only the
   target's hue and saturation. `retint()` scales the target so its
   relative luminance matches what it replaced.

   That matters for two reasons. The authored shading — the light pool,
   the aerial perspective, the cap-to-underside falloff on the moss, the
   grain in the bark — is carried entirely in those luminance
   relationships, and substituting raw hex would flatten it. And the
   source's colour space is not stated anywhere; preserving a ratio is
   correct whether the literals are linear or sRGB, where a hex
   substitution would only be correct in one of them.
   ================================================================== */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const DIR = resolve("src/shaders/sylva-living-world/sources");
const CANON = resolve(DIR, "inner-green-3d.html");
const DERIVED = resolve(DIR, "inner-sakura-portfolio.html");
const THREE_JS = resolve(DIR, "inner-green-assets/three.min.js");

/* ---- colour helpers ------------------------------------------------ */

const hex = (h) => {
    const n = parseInt(h.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
};
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Take the hue of `targetHex`, keep the luminance of `orig` (scaled by
 * `gain`), and control chroma with `sat`.
 *
 * `sat` is not a nicety. Matching luminance alone against a pale target
 * gives grey: #F5DEDC has a relative luminance of 0.87, so scaling it
 * down to the 0.34 of the moss crown it replaces lands on a warm grey
 * with almost no hue left. The first pass did exactly that and the
 * blossom came out colourless. Pushing the channels back out from their
 * own luminance restores the hue without touching the brightness the
 * authored shading depends on.
 */
function retint(orig, targetHex, gain = 1, sat = 1) {
    const t = hex(targetHex);
    const tl = lum(t);
    if (tl <= 0) return [0, 0, 0];
    const k = (lum(orig) * gain) / tl;
    let c = t.map((x) => x * k);
    if (sat !== 1) {
        const g = lum(c);
        c = c.map((x) => Math.max(0, g + (x - g) * sat));
    }
    return c;
}

const fmt = (v) => v.map((c) => c.toFixed(4)).join(", ");

/** Build a replacement for a literal `vec3(a, b, c)` found in the GLSL. */
function v3(origLiteral, targetHex, gain = 1, sat = 1) {
    const nums = origLiteral.match(/[\d.]+/g).map(Number);
    return `vec3(${fmt(retint(nums, targetHex, gain, sat))})`;
}

/* ---- the reference palette ----------------------------------------
   Sampled from the supplied image for the backgrounds; art direction
   for the rest, as the brief states. */
const P = {
    bgUpper: "#372A33",
    bgMain: "#3A2D36",
    bgLower: "#453841",
    blossomHi: "#F5DEDC",
    blossomBlush: "#E8BDC7",
    rose: "#D79AAA",
    roseDeep: "#8E5C6B",
    bark: "#28211E",
    barkPale: "#463A38",
    moss: "#55543A",
    mossDeep: "#2E2E20",
};

/* ---- every difference from the canonical source --------------------
   `expect` is asserted: if a pattern stops matching its source exactly
   that many times, the build fails rather than quietly skipping it. */
const EDITS = [
    /* -- the pointer bridge, injected into the authored scope. See
          POINTER_BRIDGE above for why it cannot be its own script tag. -- */
    {
        label: "accept forwarded pointer from the host",
        /* Anchored on the BODY of the listener, not just its name. There
           are three `pointerleave` registrations in the document — the
           dock button and the spec canvas have their own — and matching
           the name alone hit two of them. This one is identified by the
           only line that resets both systems at once. */
        find: /window\.addEventListener\('pointerleave', function \(\) \{\s*pointer\.x = pointer\.y = 0; ndc\.x = 10;\s*\}\);/,
        to: (m) => `${m}\n${POINTER_BRIDGE}`,
        expect: 1,
    },

    /* -- the anchor broadcast, hooked onto the end of the authored
          renderFrame. See ANCHOR_BROADCAST above for why it lives here
          and not in its own loop. -- */
    {
        label: "publish branch anchors to the host each frame",
        find: /renderer\.render\(scene, camera\);/,
        to: (m) => `${m}${ANCHOR_BROADCAST}`,
        expect: 1,
    },

    /* -- the only asset reference in the document, and it has to go.
          The source loads Lexend from inner-green-assets/, which this
          adaptation does not ship. Inside the srcDoc sandbox the request
          resolves against a null origin, so it fails CORS and lands two
          errors in the console on every mount — for a typeface used only
          by the dock, headings and cards that the scene-only integration
          already strips. The body's font-family stack is left alone and
          simply falls through. -- */
    {
        label: "drop the @font-face (asset we do not ship)",
        find: /@font-face\{[^}]*\}/,
        to: () => "/* @font-face removed: the scene carries no text. */",
        expect: 1,
    },

    /* -- the page ground. The renderer runs setClearColor(0x000000, 0),
          i.e. fully transparent, so the background a viewer sees is CSS
          showing through the canvas. -- */
    {
        label: "html background -> transparent",
        find: /html\{\s*background:#383b34;/,
        to: (m) => m.replace("#383b34", "transparent"),
        expect: 1,
    },
    {
        label: "body background -> transparent",
        find: /background:#383b34;\s*overflow-x:hidden/,
        to: (m) => m.replace("#383b34", "transparent"),
        expect: 1,
    },
    /* -- The ground and its light pools LEAVE THE SCENE ENTIRELY.

          The renderer already clears fully transparent, but the document
          did not: body carried the plum and .hero carried the plum plus
          two radial light pools. Either one alone paints an opaque sheet,
          and with the scene now layered ABOVE the project cards so the
          branches can occlude them, an opaque sheet hides the cards
          completely.

          So every painted background in the document goes transparent and
          the identical gradients are reproduced on the host section in
          ProjectStack.module.css, beneath the cards. Same colours, same
          stops — the layers move either side of the card, the picture
          does not change. -- */
    {
        label: "hero ground + light pools -> transparent (relocated to host)",
        find: /background:\s*radial-gradient\(64% 52% at 27% 84%[^;]+;/,
        to: () => "background: transparent;",
        expect: 1,
    },
    {
        label: "hero floor pool -> transparent (relocated to host)",
        find: /background:\s*radial-gradient\(72% 44% at 50% 117%[^;]+;/,
        to: () => "background: transparent;",
        expect: 1,
    },

    /* -- the blossom. These four are the moss-blade gradient, and they
          are the single biggest change: in this scene they are the dense
          mounded green that covers the boughs, and in the reference that
          mass reads as clusters of pale blossom. deep -> tipHi runs from
          the shadowed interior of a mound to its lit crown, so the
          retint keeps that ramp and only moves it into rose. -- */
    { label: "blossom: mound interior", find: /vec3\(0\.0126, 0\.0192, 0\.0031\)/, to: (m) => v3(m, P.roseDeep, 1.0, 2.3), expect: 1 },
    { label: "blossom: mid",            find: /vec3\(0\.0488, 0\.0744, 0\.0121\)/, to: (m) => v3(m, P.rose, 1.0, 2.5), expect: 1 },
    { label: "blossom: tip",            find: /vec3\(0\.1222, 0\.1860, 0\.0304\)/, to: (m) => v3(m, P.blossomBlush, 1.02, 2.6), expect: 1 },
    /* The crown's `sat` stays at 2.0 while the three below it rise.

       It is the brightest value in the scene, so it is the one with the
       least headroom: pushing chroma out from a luminance this high drives
       channels past 1.0, and everything past 1.0 clips to the same white.
       Saturating it harder would not make it pinker, it would flatten the
       lit tips into a paper-white crust — the opposite of what raising the
       other three is for. */
    { label: "blossom: lit crown",      find: /vec3\(0\.2600, 0\.3900, 0\.0640\)/, to: (m) => v3(m, P.blossomHi, 1.10, 2.0), expect: 1 },

    /* -- moss ON the bough JOINS THE BLOSSOM, and this is the single
          change that decides whether the scene reads as the reference.

          It used to stay olive, on the reasoning that the reference keeps
          visible moss along the bark. That was the wrong read of the
          proportions. This surface and the ground cover below are the two
          LARGE continuous masses in the frame; the blossom mound is a
          crust on top of them. Leaving both olive meant the eye met khaki
          first and pink second, which is the reference inverted.

          So the mass goes rose and the mound stays the brightest part of
          it — the ramp dark -> lit -> cap now runs from the shadowed
          interior of a blossom bank to its lit crown, instead of from
          moss to moss. retint() holds each original's luminance, so the
          authored cap-to-underside falloff is unchanged; only the hue
          moves. -- */
    { label: "bough moss: dark", find: /vec3\(0\.0204, 0\.0311, 0\.0050\)/, to: (m) => v3(m, P.roseDeep, 1.0, 1.9), expect: 1 },
    { label: "bough moss: lit",  find: /vec3\(0\.0914, 0\.1392, 0\.0227\)/, to: (m) => v3(m, P.rose, 1.0, 2.1), expect: 1 },
    { label: "bough moss: cap",  find: /vec3\(0\.162, 0\.176, 0\.132\)/,    to: (m) => v3(m, P.blossomBlush, 1.02, 2.2), expect: 1 },

    /* -- bark: dark and textured, as the reference. The grain is carried
          by the mix factor, which is untouched. -- */
    { label: "bark: silver dark", find: /vec3\(0\.020, 0\.019, 0\.018\)/,   to: (m) => v3(m, P.bark), expect: 1 },
    { label: "bark: silver lit",  find: /vec3\(0\.290, 0\.283, 0\.264\)/,   to: (m) => v3(m, P.barkPale), expect: 1 },
    { label: "bark: umber dark",  find: /vec3\(0\.024, 0\.019, 0\.016\)/,   to: (m) => v3(m, P.bark), expect: 1 },
    { label: "bark: umber lit",   find: /vec3\(0\.175, 0\.140, 0\.110\)/,   to: (m) => v3(m, P.barkPale, 1.04), expect: 1 },

    /* -- the low ground cover under the boughs. The second large mass,
          and it follows the boughs for the same reason: it fills the
          bottom of the frame, so leaving it olive would have put a khaki
          floor under a pink canopy. -- */
    { label: "ground cover: dark", find: /vec3\(0\.0270, 0\.0450, 0\.0099\)/, to: (m) => v3(m, P.roseDeep, 1.0, 1.8), expect: 1 },
    { label: "ground cover: lit",  find: /vec3\(0\.0690, 0\.1150, 0\.0253\)/, to: (m) => v3(m, P.rose, 1.0, 2.0), expect: 1 },

    /* -- ferns: THE LAST GREEN IN THE SCENE, and kept green on purpose.

          With the boughs and the ground cover moved into rose, these and
          the bark are the only things left for the blossom to read
          against. Take the ferns pink as well and the frame goes
          monochrome — the mound stops being a mound and becomes a flat
          pink field. They are small and scattered, which is exactly what
          makes them affordable as the accent. -- */
    { label: "fern face", find: /vec3\(0\.330, 0\.560, 0\.042\)/, to: (m) => v3(m, P.moss, 1.05), expect: 1 },
    { label: "fern edge", find: /vec3\(0\.062, 0\.190, 0\.014\)/, to: (m) => v3(m, P.mossDeep), expect: 1 },

    /* -- the pointer trail. Authored behaviour is untouched; only its
          colour moves, so the parting still reads against blossom. -- */
    { label: "pointer trail: core", find: /vec3\(0\.30, 0\.72, 0\.46\)/, to: (m) => v3(m, P.rose), expect: 1 },
    { label: "pointer trail: hot",  find: /vec3\(0\.86, 1\.00, 0\.90\)/, to: (m) => v3(m, P.blossomHi), expect: 1 },

    /* -- the small flowers already on the boughs: warmed to ivory so
          they sit inside the blossom palette instead of against it. -- */
    { label: "flower: base dark", find: /vec3\(0\.020, 0\.019, 0\.011\)/, to: (m) => v3(m, P.roseDeep), expect: 1 },
    { label: "flower: base lit",  find: /vec3\(0\.070, 0\.064, 0\.030\)/, to: (m) => v3(m, P.blossomBlush), expect: 1 },
    { label: "flower: highlight", find: /vec3\(0\.46, 0\.44, 0\.24\)/,    to: (m) => v3(m, P.blossomHi), expect: 1 },

    /* -- the butterfly is KEPT, as the brief requires, and only its two
          green-leaning wing tints move. Its geometry, its flight cycle
          and its wing animation are untouched. -- */
    { label: "butterfly: wing shimmer A", find: /vec3\(0\.46, 1\.14, 0\.30\)/, to: (m) => v3(m, P.rose), expect: 1 },
    { label: "butterfly: rim green",      find: /vec3\(0\.34, 0\.60, 0\.12\)/, to: (m) => v3(m, P.moss), expect: 1 },

    /* -- lighting. These are REAL uniforms, which is the route the brief
          prefers over shader edits; they were simply the only colours
          exposed that way. Key stays warm, fill and air move to plum so
          the aerial perspective recedes into the background rather than
          toward green. -- */
    {
        label: "light: uFillCol -> plum bounce",
        find: /uFillCol:\s*\{\s*value:\s*new THREE\.Color\(0\.78, 0\.78, 0\.62\)/,
        to: (m) => m.replace("0.78, 0.78, 0.62", fmt(retint([0.78, 0.78, 0.62], P.bgLower, 1.0))),
        expect: 1,
    },
    {
        label: "light: uAmbCol -> plum air",
        find: /uAmbCol:\s*\{\s*value:\s*new THREE\.Color\(0\.086, 0\.090, 0\.080\)/,
        to: (m) => m.replace("0.086, 0.090, 0.080", fmt(retint([0.086, 0.09, 0.08], P.bgMain, 1.0))),
        expect: 1,
    },
];

/* ---- the anchor broadcast -------------------------------------------
   The one behavioural addition, and the only way to hang cards on real
   branches from outside a sandbox.

   The scene is in an iframe with `allow-scripts` and deliberately not
   `allow-same-origin`, so the host cannot read the scene graph, the
   camera, or even the document. Rather than weaken that, the scene
   publishes what the host needs: four branch points, already projected
   to CSS pixels, once per frame.

   WHERE IT HOOKS. Straight after `renderer.render(scene, camera)`, at
   the end of the authored `renderFrame`. That function is driven by the
   authored `tick()` loop, which means this inherits the whole existing
   lifecycle for free — it stops when the loop stops, and under reduced
   motion `tick` runs exactly once, so the host receives exactly one
   message with final positions. No second animation loop is introduced,
   which the brief forbids and which would also drift from the camera it
   is supposed to track.

   WHAT THE ANCHORS ARE. Points taken from `nearLimbs`, the actual limb
   objects the boughs are built from: a point on the limb's own
   CatmullRomCurve3, lifted by that limb's `rw(t)` radius so it sits on
   the bark surface rather than inside it. They are chosen once and kept
   in nearGroup's LOCAL space, then pushed through the group's world
   transform and the camera every frame — so they stay welded to the
   branch through parallax, through the group's rotation, and through a
   resize. Not screen coordinates, and not pollen.

   Chosen by spreading across the frame toward the brief's 12.5 / 37.5 /
   62.5 / 87.5 guides, preferring points nearer the top of a bough so a
   card perches rather than buries itself in foliage. */
const ANCHOR_BROADCAST = `
        try {
          var SA = window.__sakuraAnchors || (window.__sakuraAnchors = { pts: null, last: '' });

          /* Picked once, and only after the entrance finishes. Waiting is
             not politeness: the scan builds temporary wireframe meshes and
             disposes them when it completes, so choosing earlier risks
             welding a card to geometry that is about to be deleted. */
          /* Capped at 45 attempts. The search is cheap once and ruinous
             every frame — before the cap it re-traversed the whole crown on
             177 consecutive frames at 1920, because nothing ever told it to
             stop failing. Retrying at all is worth it only because the
             camera is still easing after the entrance, so a few dozen
             frames of drift can bring a bough into the window; past that
             the answer is not going to change and the host's own layout
             stands. */
          if (!SA.pts && !scanning && nearGroup && window.THREE && (SA.tries = (SA.tries || 0) + 1) <= 45) {
            var cand = [];
            nearGroup.updateWorldMatrix(true, true);
            nearGroup.traverse(function (o) {
              if (!o.isMesh || !o.geometry || !o.visible) return;
              var at = o.geometry.attributes;
              /* Boughs only. Ferns, flowers and twigs are small meshes and
                 make for flimsy attachment points. */
              if (!at || !at.position || !at.normal || at.position.count < 400) return;
              /* 1500 samples per bough, not 200.

                 200 was a token sample, and the survival rate through the
                 two filters below is brutal: a bough is a tube, so only the
                 sliver of its vertices whose normal points up clears
                 normal.getY >= 0.55, and the on-screen window then takes
                 another bite. The pool that actually came out was ELEVEN
                 points at 1440 and THREE at 1920 — and at three the picker
                 never ran at all, which is why the widest viewports fell
                 back to four evenly spaced positions attached to nothing.

                 This runs ONCE per mount, guarded by !SA.pts, not per
                 frame. A few thousand projections one time is nothing next
                 to a frame of this scene, and it turns a pool that was
                 scraping the minimum into one with room to choose. */
              var step = Math.max(1, Math.floor(at.position.count / 1500));
              for (var i = 0; i < at.position.count; i += step) {
                /* Upper surface only, so a card perches on a bough rather
                   than hanging off its underside — but 0.35, not 0.55.

                   A bough is a tube, and 0.55 accepted only the narrow
                   crest along the very top of it. At a wide aspect that
                   left a HOLE in the middle of the pool: nothing at all
                   between -0.4 and +0.1 in ndc, so the picker could only
                   answer with one anchor stranded on the left and three
                   packed against the separation floor on the right. 0.35
                   takes in the upper flank as well, which is still a
                   surface a card can sit on, and the middle fills in.

                   It is not loose enough to pull in a second mesh: the pool
                   still comes entirely from the bough crown at every width
                   tested, which is what the count >= 400 filter above is
                   for. */
                if (at.normal.getY(i) < 0.35) continue;
                var lp = new window.THREE.Vector3(at.position.getX(i), at.position.getY(i), at.position.getZ(i));
                var v = o.localToWorld(lp.clone()).project(camera);
                /* 0.92 rather than 0.86. The camera holds a fixed
                   HORIZONTAL fov, so a wider viewport at the same height
                   narrows the vertical one and crops the crown — which is
                   what took the pool from 111 points at 1280 to 30 at 1920.
                   The extra 0.06 is still comfortably inside the frame. */
                if (Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.92 || v.z > 1) continue;
                cand.push({ obj: o, local: lp, ndx: v.x, ndy: v.y });
              }
            });
            if (cand.length >= 4) {
              /* Spread toward the brief's 12.5 / 37.5 / 62.5 / 87.5 guides,
                 with two constraints that a plain nearest-to-target search
                 does not give you.

                 MINIMUM SEPARATION. Without it the search happily returns
                 two anchors 40px apart, because one tall stretch of bough
                 scores well for two different targets — and two cards
                 cannot share 40px. 0.34 in NDC is about a card width plus
                 its gap at any sane canvas size.

                 A CONSISTENT HEIGHT BAND. Anchors chosen purely for height
                 came back at y=319 and y=650 in the same frame, which
                 would leave one card perched and another trailing a 300px
                 connector. Scoring against the candidates' own median
                 height keeps the four comparable, so the cards can sit in
                 the two gentle levels the brief asks for and still reach
                 their branch in 16-64px. */
              /* The 70th percentile rather than the median, i.e. biased
                 toward the upper boughs. Most candidate vertices belong to
                 the big low limbs, so a median pulled all four anchors to
                 the bottom of the frame — which left the cards sitting on
                 the dock and a dead gap under the heading. */
              var ys = cand.map(function (c) { return c.ndy; }).sort(function (a, b) { return a - b; });
              var midY = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.70))];

              /* THE GUIDES FOLLOW THE CROWN, THEY DO NOT SIT AT FIXED NDC.

                 12.5 / 37.5 / 62.5 / 87.5 are proportions of the SPREAD OF
                 BOUGH THAT IS ACTUALLY ON SCREEN, not of the viewport. Hard
                 -coding them at -0.75/-0.25/0.25/0.75 assumed the crown
                 fills the frame, and at a wide aspect it does not: the same
                 camera shows the same tree across a smaller slice of ndc,
                 so the outer two guides land in empty sky. The search then
                 answered the only way it could — it returned the nearest
                 bough for both outer targets, which is the SAME end of the
                 crown, and three of the four cards ended up stacked in the
                 right third at the separation floor while one sat alone on
                 the left.

                 Taking the 4th and 96th percentiles rather than the true
                 min and max keeps one stray vertex on a far twig from
                 stretching the guides back out to the same failure. */
              var xs = cand.map(function (c) { return c.ndx; }).sort(function (a, b) { return a - b; });
              var xLo = xs[Math.floor(xs.length * 0.04)];
              var xHi = xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.96))];
              var span = Math.max(0.001, xHi - xLo);
              /* Relax the separation until four fit, rather than giving up.

                 A fixed 0.34 found nothing at 1280x720 — the frame is
                 shorter, fewer vertices survive the on-screen filter, and
                 the search returned three. Returning nothing meant the
                 host never heard from the scene at all. Now it tries
                 progressively closer spacings and only abandons the
                 attempt if even the loosest cannot seat four, in which
                 case the host's own layout stands. */
              var targets = [
                xLo + span * 0.125, xLo + span * 0.375,
                xLo + span * 0.625, xLo + span * 0.875,
              ];
              var picked = [];
              /* THE LADDER IS IN PIXELS, NOT IN NDC, and that distinction
                 is the whole reason this works at every width.

                 The camera holds a fixed VERTICAL fov, so a wider viewport
                 widens the horizontal fov with it and the same bough spans
                 LESS ndc across a wider canvas. A constant ndc floor is
                 therefore a different physical distance at every width: at
                 1440 a 0.22 gap is 158px, at 1920 it is 211px. That is why
                 a floor tuned until it passed at 1280 then found nothing at
                 all at 1830 and 1920 — the four cards fitted, the units
                 lied.

                 What actually has to be true is a distance in css pixels:
                 a card plus its gap, 270 + 24. So the ladder is written in
                 pixels and converted through the live canvas width.

                 AND THE LAST RUNG IS 60px, NOT NOTHING. Returning nothing
                 is the worst outcome available — the host falls back to
                 four evenly spaced positions that belong to no branch at
                 all, which is exactly the disconnected look this work is
                 fixing. Four anchors pressed too close is a far better
                 failure: the host's separation pass pulls the cards apart
                 and the stems lean to reach their own branch point, so the
                 cards stay in the tree. It is 60 rather than 0 only so the
                 four picks are guaranteed to be four distinct vertices. */
              var pxW = renderer.domElement.clientWidth || 1440;
              var gapsPx = [294, 240, 190, 150, 110, 60];

              /* BOTH TERMS OF THE SCORE ARE IN PIXELS, and that is the
                 whole correction here.

                 The original score added an ndc-x distance to an ndc-y
                 distance at a 0.45 weight, and those are not the same unit
                 on a non-square canvas: at 1920x900 one unit of ndc-x is
                 960px and one of ndc-y is 450px, so the "0.45 weight on
                 height" was really about 0.21, and height lost every
                 argument. That is how four anchors came back spanning 319px
                 vertically, one card up by the heading and another down on
                 the dock trailing a long connector.

                 Converting both to css pixels first makes the 0.8 weight
                 mean what it says: a candidate one pixel further from its
                 guide is worth about the same as one 1.25 pixels off the
                 common height. */
              var pxH = renderer.domElement.clientHeight || 900;
              for (var g = 0; g < gapsPx.length && picked.length < 4; g++) {
                var gapN = gapsPx[g] * 2 / pxW;
                picked = [];
                for (var k = 0; k < 4; k++) {
                  var best = null, bestScore = 1e9;
                  for (var c = 0; c < cand.length; c++) {
                    var far = true;
                    for (var q2 = 0; q2 < picked.length; q2++) {
                      if (Math.abs(cand[c].ndx - picked[q2].ndx) < gapN) { far = false; break; }
                    }
                    if (!far) continue;
                    var score = Math.abs(cand[c].ndx - targets[k]) * 0.5 * pxW
                              + Math.abs(cand[c].ndy - midY) * 0.5 * pxH * 0.8;
                    if (score < bestScore) { bestScore = score; best = cand[c]; }
                  }
                  if (!best) break;
                  picked.push(best);
                }
              }
              if (picked.length === 4) {
                picked.sort(function (a, b) { return a.ndx - b.ndx; });

                SA.pts = picked;
              }
            }
          }

          if (SA.pts) {
            var el = renderer.domElement, cw = el.clientWidth, ch = el.clientHeight, out = [];
            for (var p = 0; p < SA.pts.length; p++) {
              var q = SA.pts[p];
              var w = q.obj.localToWorld(q.local.clone()).project(camera);
              out.push({
                x: Math.round(((w.x * 0.5 + 0.5) * cw) * 10) / 10,
                y: Math.round(((-w.y * 0.5 + 0.5) * ch) * 10) / 10,
                visible: w.z <= 1 && Math.abs(w.x) <= 1 && Math.abs(w.y) <= 1
              });
            }
            var msg = { source: 'sakura-anchors', w: cw, h: ch, entranceDone: !scanning, anchors: out };
            var sig = JSON.stringify(msg);
            if (sig !== SA.last) { SA.last = sig; parent.postMessage(msg, '*'); }
          }
        } catch (e) { /* never let the overlay take the scene down */ }
`;

/* ---- pointer forwarding ---------------------------------------------
   The scene is layered ABOVE the project cards so the branches occlude
   them, which means the iframe must be `pointer-events: none` or it
   would swallow every click meant for a card. That also cuts the scene
   off from its own input, so the host forwards it.

   Two separate systems need feeding, and they use different coordinates:

     pointer.x/y   camera parallax, normalised over the window
     ndc.x/y       foliage parting and spray trails — updateMouse()
                   raycasts this through the camera onto crownPlane to
                   set uMouseNear/uMouseFar, and treats ndc.x > 2 as
                   "pointer is away"

   IT MUST BE INJECTED INTO THE AUTHORED SCOPE, not added as its own
   <script> tag. `pointer` and `ndc` are closure variables inside the
   scene's IIFE; a separate tag runs in global scope and cannot see
   either of them. So this is appended directly after the authored
   `pointerleave` listener, which is registered in exactly the scope that
   holds both.

   The authored listeners are left in place and simply never fire, which
   keeps this reversible: drop the pointer-events rule on the iframe and
   the scene goes straight back to reading its own input. */
const POINTER_BRIDGE = `
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d) return;
      if (d.source !== 'sakura-pointer') return;
      if (!d.inside) { pointer.x = 0; pointer.y = 0; ndc.x = 10; return; }
      pointer.x = d.px; pointer.y = d.py;
      ndc.x = d.nx; ndc.y = d.ny;
    });`;

/* ---- the three strings the React adapter depends on ----------------
   It isolates the scene with indexOf on the first two and throws
   "Sylva scene adapter could not isolate the authored Three.js scene."
   if either is missing. It patches reduced motion by string-replacing
   the third — and THAT one fails silently: change its whitespace and
   reduced-motion visitors keep getting a full animation with no error
   anywhere. All three are asserted after the edits run. */
const MARKERS = [
    '<main class="hero" id="hero">',
    '<script src="inner-green-assets/three.min.js"></script>',
    "(function loop() { requestAnimationFrame(loop); tick(); })();",
];

/* ---- run ------------------------------------------------------------ */

for (const f of [CANON, THREE_JS]) {
    if (!existsSync(f)) {
        console.error(`missing: ${f}\nVendor it from node_modules/@designcodeio/threeui first.`);
        process.exit(1);
    }
}

/* PARSE WHAT WE INJECT, BEFORE INJECTING IT.

   Both snippets below are JavaScript carried as template literals, so
   nothing type-checks them and nothing lints them — `npm run build`
   compiles a string and reports success. Their only reader is a browser
   inside a sandboxed iframe with no same-origin access, so when one of
   them fails to parse the scene simply never renders and the console the
   error lands in is not one anybody sees.

   That is not hypothetical: deleting a block from ANCHOR_BROADCAST took
   its closing brace with it, the build passed, and the section shipped
   with no boughs at all. `new Function` parses without executing, so the
   undefined identifiers these rely on from the authored scope are fine —
   it catches exactly the class of mistake that was invisible. */
for (const [label, src] of [
    ["POINTER_BRIDGE", POINTER_BRIDGE],
    ["ANCHOR_BROADCAST", ANCHOR_BROADCAST],
]) {
    try {
        new Function(src);
    } catch (err) {
        console.error(
            `INJECTION DOES NOT PARSE: ${label}\n  ${err.message}\n` +
            `This would ship a scene that renders nothing. Aborting.`,
        );
        process.exit(1);
    }
}

const canon = readFileSync(CANON, "utf8");
let out = canon;
let applied = 0;

for (const e of EDITS) {
    const hits = out.match(new RegExp(e.find.source, e.find.flags + "g")) ?? [];
    if (hits.length !== e.expect) {
        console.error(
            `EDIT FAILED: "${e.label}" matched ${hits.length} times, expected ${e.expect}.` +
            `\nThe canonical source has changed. Re-locate this colour before shipping.`,
        );
        process.exit(1);
    }
    out = out.replace(e.find, e.to);
    applied += 1;
}

for (const m of MARKERS) {
    if (!out.includes(m)) {
        console.error(
            `MARKER LOST: ${JSON.stringify(m.slice(0, 60))}\n` +
            `The React adapter depends on this string exactly. Aborting.`,
        );
        process.exit(1);
    }
}

writeFileSync(DERIVED, out, "utf8");

/* The host cannot import .html as a string, so the adapter's own
   approach is used: emit the document and the runtime as string modules.
   JSON.stringify rather than a template literal, because 195 KB of
   authored source contains backticks and ${ and must not be re-parsed. */
const banner = (what) =>
    `/* GENERATED by scripts/sakura-scene.mjs — do not edit.\n   ${what}\n   Edit the script, or the canonical source, and re-run. */\n`;

/* Unambiguous names on purpose. The package calls its equivalents
   `inner-green-3d.html.js` and `three.min.js.js`; a double extension
   like `.html.ts` or `.min.js.ts` makes TypeScript's module resolution
   guess, and `three.min.js` in particular reads as a JS file this
   project does not allow importing. */
writeFileSync(
    resolve(DIR, "sakuraDocument.ts"),
    `${banner("The derived Sakura presentation, as a string.")}export default ${JSON.stringify(out)};\n`,
    "utf8",
);
writeFileSync(
    resolve(DIR, "threeRuntime.ts"),
    `${banner("Three.js r149, carried verbatim from the source package.")}export default ${JSON.stringify(readFileSync(THREE_JS, "utf8"))};\n`,
    "utf8",
);

const sha = (s) => createHash("sha256").update(s).digest("hex");

console.log(`applied ${applied}/${EDITS.length} colour edits; all ${MARKERS.length} adapter markers intact\n`);
console.log("canonical  inner-green-3d.html        " + sha(canon));
console.log("derived    inner-sakura-portfolio.html " + sha(out));
console.log("runtime    three.min.js               " + sha(readFileSync(THREE_JS, "utf8")));
console.log(`\nderived document ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB, runtime ${(Buffer.byteLength(readFileSync(THREE_JS)) / 1024).toFixed(0)} KB`);
