/* ==================================================================
   CAT DATA — what scripts/book-cat.mjs made of the cat's footage.

   public/book/cat/cat.json, fetched once. Boxes and polygons are in the
   footage's source pixels (1280 x 720), so they go through the same fit
   as the canvas and land on the frame exactly where they were filmed.
   ================================================================== */

export type Cue =
    | { t: number; event: "penNudge"; dx: number; rot: number }
    | { t: number; event: "gust"; cord: string; strength: number };

/* A one-shot clip over an overhead page: an animated WebP with alpha. */
export type OverlayClip = { src: string; box: number[]; duration: number; cues: Cue[] };

export type EndClip = { mp4: string; webm?: string; duration: number };

export type Region = "head" | "chin" | "ear" | "back" | "tail" | "paws" | "neck" | "face";

export type CatData = {
    walk?: OverlayClip;
    peek?: OverlayClip;
    end?: {
        /* The patch the end clips cover, over the canvas's end frame. */
        box: number[];
        still: string;
        /* The waiting loops, played in turn, and every other clip by name. */
        idle: string[];
        clips: Record<string, EndClip>;
        /* Where on her each kind of petting lands: polygons, source px. */
        regions: Partial<Record<Region, number[][]>>;
    };
};

let loading: Promise<CatData | null> | null = null;

export function loadCat(): Promise<CatData | null> {
    loading ??= fetch("/book/cat/cat.json")
        .then((r) => (r.ok ? (r.json() as Promise<CatData | null>) : null))
        .catch(() => null);
    return loading;
}

/* The same image file, as a fresh resource each time it is shown. An
   animated WebP shown twice from one URL shares one animation (it would
   resume, or sit on its last frame); a new object URL starts it from the
   first frame, without fetching it again. */
const blobs = new Map<string, Promise<Blob | null>>();

export function freshUrl(src: string): Promise<string | null> {
    let b = blobs.get(src);
    if (!b) {
        b = fetch(src)
            .then((r) => (r.ok ? r.blob() : null))
            .catch(() => null);
        blobs.set(src, b);
    }
    return b.then((blob) => (blob ? URL.createObjectURL(blob) : null));
}

/* ?cat=always / ?cat=never, for trying it out; otherwise the site's rule. */
export function catOverride(): "always" | "never" | null {
    if (typeof window === "undefined") return null;
    const v = new URLSearchParams(window.location.search).get("cat");
    return v === "always" || v === "never" ? v : null;
}
