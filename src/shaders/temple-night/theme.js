/* ============================================================================
   temple-night · sakura-moon theme
   ----------------------------------------------------------------------------
   Every colour and weather constant the world reads, in one place. The geometry,
   the shaders, the pass chain and the interaction model are untouched by this
   file — it only decides what the night looks like.

   Two colour spaces live here and they are not interchangeable:

     · `0x……` values go on MeshStandardMaterial.color / light.color. Three
       decodes those out of sRGB for you, so write them as you would in CSS.
     · `hdr:[r,g,b]` values are multipliers on an already-decoded map, used for
       emitters (lantern panes, shoji paper, the moon disc). They are LINEAR.
       A display ratio of .78 is a linear ratio of .78^2.2 ≈ .58, which is why
       the moon tint below looks less pink than the plate does. Reading a ratio
       straight off a screenshot and pasting it here is what turns a rose moon
       into a pale grey one.

   Measured off the reference plate (night hanami, violet key, one warm
   accent): the frame has exactly one warm hue — the lantern/window amber —
   sitting inside a violet-to-mauve field, with the moon as a cool rose. Keep
   that ratio. Adding a second warm source anywhere is what flattens it.
   ========================================================================== */

export const THEME = {
  name: 'sakura-moon',

  /* ---- atmosphere ------------------------------------------------------ */
  air: {
    clear:      0x1e1936,   /* renderer clear */
    background: 0x231d3d,   /* scene.background */
    fog:        0x2b2246,   /* violet, not teal — this is what tints the hall */
    fogDensity: 0.0150,     /* lower than the original: the plate keeps three
                               readable hill layers, 0.0168 eats the second */
  },

  /* ---- sky ------------------------------------------------------------- */
  sky: {
    tint: [0.66, 0.60, 0.78],                /* hdr multiplier on the gradient */
    stops: [
      [0.00, 'rgb(28,23,52)'],
      [0.30, 'rgb(38,29,62)'],
      [0.60, 'rgb(54,38,76)'],
      [0.85, 'rgb(74,50,88)'],
      [1.00, 'rgb(58,41,72)'],
    ],
    glow:   ['rgba(214,138,170,.26)', 'rgba(140,84,126,.12)'],  /* behind the ridge */
    star:   'rgba(226,214,244,',                                 /* alpha appended */
    stars:  300,                                                 /* fewer: the plate is hazier */
  },

  /* ---- the moon -------------------------------------------------------- */
  moon: {
    x: 21.5, y: 33.5, z: -72, r: 11.5,       /* larger + higher-right than Kage */
    hdr:  [2.35, 1.36, 1.52],                /* rose: blue ABOVE green */
    halo: ['rgba(255,176,198,.85)', 'rgba(214,116,158,.24)'],
    haloScale: 5.2,
    haloOpacity: 0.40,
  },

  /* ---- cloud bands (new: the plate has three crossing the moon) --------- */
  cloud: {
    core: 'rgba(226,186,214,.50)',
    mid:  'rgba(150,116,168,.26)',
    edge: 'rgba(84,64,114,0)',
    bands: [
      /*  x     y     z     w    h   opacity */
      [ 26.0, 30.0, -70, 46, 11, 0.50 ],
      [ 14.0, 37.5, -69, 38,  8, 0.34 ],
      [ -8.0, 26.0, -74, 54, 12, 0.26 ],
    ],
  },

  /* ---- distant land ---------------------------------------------------- */
  ridge: {
    ink: '#2a2340',                          /* the silhouette itself */
    /*  z,  y,   w,   h,   x,   tint */
    layers: [
      [-96, 14.0, 320, 28,   0, 0x3a2c54],
      [-78, 11.0, 250, 22,  18, 0x312548],
      [-60,  8.5, 200, 17, -14, 0x281e3c],
    ],
  },

  /* ---- masonry, timber, tile ------------------------------------------- */
  stone: {
    wallBase:   '#171425',
    wallTint:   0x5b5474,
    floorBase:  '#1b1830',
    floorTint:  0x554e6e,
    floorRough: 0.86,        /* the plate is matte: no wet-slate specular */
    floorMetal: 0.02,
    platTint:   0x4c4566,
    graniteBase:[86, 82, 108],
    graniteTint:0x9a92b4,
    mossTint:   [58, 84, 60],
    boulder:    0x2c2542,
  },
  timber: {
    woodBase:  [48, 34, 44],
    hallTint:  0x4a4058,
    postTint:  0x7a6478,
    gold:      0xb9925a,
    tileBase:  '#241f35',
    tileTint:  0x3d3550,
    tileRib:   'rgba(168,150,210,.14)',
  },
  torii: {
    coat:   '#8e3b36',       /* the lacquer pass */
    hdr:    [1.42, 0.62, 0.60],
    gold:   0xb08a52,
    cap:    0x2a1b28,
    scale:  0.92,            /* the gate is the foreground subject here */
    z:     -7.0,
  },

  /* ---- the one warm accent --------------------------------------------- */
  ember: {
    paperHdr:   [1.25, 0.75, 0.25],          /* shoji bays */
    lanternHdr: [2.60, 1.30, 0.48],          /* lantern panes */
    lanternGlow:['rgba(255,196,110,.92)', 'rgba(255,150,60,.26)'],
    hallGlow:   ['rgba(255,186,110,.72)', 'rgba(240,136,52,.20)'],
    motes:      ['rgba(255,216,168,1)', 'rgba(255,164,86,.32)'],
    moteRgb:    [1.55, 1.02, 0.56],
  },

  /* ---- blossom --------------------------------------------------------- */
  sakura: {
    petal:    0xf3a8c8,      /* instance base */
    petalHi:  0xffd7e8,
    petalLo:  0xd074a8,
    emissive: 0x3a1430,
    emissiveIntensity: 0.30,
    bark:     0x3f2c4a,
    canopyPerTip: 11,        /* 9 in Kage; blossom clusters read denser */
    fall: {
      count:  320,           /* 260 leaves → 320 petals: they are smaller */
      size:   0.30,
      speed: [0.34, 0.58],   /* min, extra — petals hang, leaves drop */
      sway:  [0.40, 0.95],
      spread: 13,
      ahead:  11,
      radius: 30,
    },
  },

  /* ---- ground cover ---------------------------------------------------- */
  foliage: {
    grassTop:  '#2a4433',
    grassMid:  '#182a22',
    grassBase: '#0a0e14',
    bounce:    'rgba(196,108,148,.20)',       /* rose bounce, was ember red */
    skyLick:   'rgba(168,150,210,.16)',
    tintR: 0.86, tintG: 0.98, tintB: 1.06,    /* blades pulled toward violet */
    rockLit:   'rgba(196,186,222,.20)',
    moss:      [58, 84, 60],
  },

  /* ---- lights ---------------------------------------------------------- */
  light: {
    hemiSky: 0x6d5f9e, hemiGround: 0x1a152c, hemi: 0.30,
    key: 0xa99ad8, keyI: 1.05,
    moonKey: 0xffaec6, moonKeyI: 0.55,
    hall: 0xffc070, hallI: 2.4,
    wing: 0xffb45c, wingI: 2.1,
    moonPoint: 0xff9ab8, moonPointI: 2.2,
    fill: 0x8f7ecb, fillI: 0.85,
    stair: 0xffb867, stairI: 3.4,
    lantern: 0xffb45c, lanternI: 2.2, lanternRange: 10,
  },

  /* ---- weather --------------------------------------------------------- */
  weather: {
    rain: false,             /* the plate is a clear night */
    hazeGlow: ['rgba(190,166,224,.52)', 'rgba(126,104,172,.18)'],
    hazeOpacity: [0.05, 0.08],
    ripples: 0,              /* no standing water in this composition */
  },

  /* ---- pointer wisps --------------------------------------------------- */
  wisp: {
    stops: [
      [0.00, 'rgba(255,255,255,1)'],
      [0.07, 'rgba(255,238,246,.92)'],
      [0.16, 'rgba(248,190,216,.40)'],
      [0.34, 'rgba(216,146,186,.13)'],
      [0.62, 'rgba(158,104,152,.035)'],
      [1.00, 'rgba(120,80,130,0)'],
    ],
  },

  /* ---- grade ----------------------------------------------------------- */
  post: {
    threshold: 0.72, knee: 0.45,   /* the plate blooms broadly and softly */
    bloom: 0.30,
    exposure: 0.80,
    chroma: 0.45,                  /* illustrative frames don't fringe */
    grain: 0.010,
    vignette: 0.82,
    saturation: 1.14,
    shadowTint: [0.96, 0.88, 1.18], shadowAmt: 0.55,   /* violet, not teal */
    highTint:   [1.05, 0.98, 0.95], highAmt:   0.22,
    contrast: 0.94, pivot: 0.42,   /* flatter than Kage: this is vector art */
  },

  /* ---- camera ---------------------------------------------------------- */
  cam: [
    { p: [ 0.0, 3.60, 15.5 ], t: [ 0.0,  8.20, -20.0 ], fov: 34 },
    { p: [-4.8, 2.60, 11.0 ], t: [ 1.0,  6.40, -15.0 ], fov: 46 },
    { p: [ 1.0, 3.90,  2.6 ], t: [-0.4,  8.20, -22.0 ], fov: 40 },
    { p: [ 4.6, 2.40, -3.0 ], t: [-2.2,  7.40, -20.0 ], fov: 44 },
    { p: [ 0.0, 8.00,-15.0 ], t: [ 0.0, 13.50, -40.0 ], fov: 42 },
    { p: [ 0.0,10.80,-19.5 ], t: [ 0.0,  3.40, -34.0 ], fov: 46 },
  ],
};

/* display hex → linear multiplier, for turning a sampled colour into an
   emitter tint without the pale-moon mistake described at the top */
export function linearFromHex(hex, gain = 1) {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const f = v => Math.pow(v, 2.2) * gain;
  return [f(r), f(g), f(b)];
}

export default THEME;
