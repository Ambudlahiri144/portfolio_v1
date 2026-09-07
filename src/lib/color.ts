/* ==================================================================
   COLOUR HELPERS

   For the handful of places that paint with the Canvas or WebGL APIs
   and therefore cannot read a CSS custom property the way a
   stylesheet can. They read the token off the document at run time
   instead of carrying a duplicated hex, so a palette change in
   globals.css cannot leave a canvas painting the old colour.
   ================================================================== */

export type Rgb = [number, number, number];

/* Parses #rgb or #rrggbb into 0..1 components. Anything else, including a
   named colour or an rgb() function, yields the fallback: the tokens are
   authored as hex and this is not trying to be a CSS parser. */
export function readHex(value: string, fallback: Rgb): Rgb {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
    if (!m) return fallback;
    const h =
        m[1].length === 3
            ? m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2]
            : m[1];
    return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
    ];
}

/* The raw string of a custom property as computed on <html>, e.g. "#f3efe6".
   Empty when called before the stylesheet has applied or on the server. */
export function cssVar(name: string): string {
    if (typeof document === "undefined") return "";
    return getComputedStyle(document.documentElement).getPropertyValue(name);
}

/* The same, already parsed. */
export function cssRgb(name: string, fallback: Rgb): Rgb {
    return readHex(cssVar(name), fallback);
}

/* A CSS colour string for the 2D canvas, which takes any CSS colour but not a
   var(). Falls back to the given literal when the token is unreadable. */
export function cssColor(name: string, fallback: string): string {
    const v = cssVar(name).trim();
    return v || fallback;
}
