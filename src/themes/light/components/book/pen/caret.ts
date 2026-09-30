import type { Caret } from "./follow";

/* ==================================================================
   CARET — where an input's or a textarea's caret is drawn.

   The browser does not say, so it is measured on a mirror: an invisible
   div styled exactly like the field, holding the text up to the caret,
   followed by a marker span. The span's offset is the caret's, less the
   field's own scroll. One mirror is reused for every field.
   ================================================================== */

const COPIED = [
    "direction", "boxSizing", "width", "overflowX", "overflowY",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontFamily", "lineHeight",
    "textAlign", "textTransform", "textIndent", "letterSpacing", "wordSpacing", "tabSize",
] as const;

let mirror: HTMLDivElement | null = null;

export function caretOf(el: HTMLInputElement | HTMLTextAreaElement): Caret {
    const cs = getComputedStyle(el);
    if (!mirror) {
        mirror = document.createElement("div");
        mirror.setAttribute("aria-hidden", "true");
        Object.assign(mirror.style, { position: "absolute", top: "0", left: "-9999px", visibility: "hidden", pointerEvents: "none" });
        document.body.appendChild(mirror);
    }
    const m = mirror;
    for (const p of COPIED) m.style[p] = cs[p];
    const area = el instanceof HTMLTextAreaElement;
    m.style.whiteSpace = area ? "pre-wrap" : "pre";
    m.style.overflowWrap = area ? "break-word" : "normal";
    m.style.height = "auto";
    if (!area) m.style.width = "auto";

    /* Email inputs have no selection API; their caret is where typing is,
       at the end. */
    let pos = el.value.length;
    let atEnd = true;
    try {
        if (el.selectionStart !== null) {
            pos = el.selectionStart;
            atEnd = pos === el.value.length && el.selectionEnd === pos;
        }
    } catch {
        /* type="email" throws in some browsers rather than returning null. */
    }

    m.textContent = el.value.slice(0, pos);
    const mark = document.createElement("span");
    mark.textContent = el.value.slice(pos) || ".";
    m.appendChild(mark);

    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const fs = parseFloat(cs.fontSize) || 16;
    const lh = parseFloat(cs.lineHeight) || fs * 1.25;
    /* A single-line input centres its line in its content box. */
    const top = area
        ? mark.offsetTop + bt - el.scrollTop
        : bt + (parseFloat(cs.paddingTop) || 0) + (el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) - lh) / 2;

    return {
        x: mark.offsetLeft + bl - el.scrollLeft,
        top,
        h: lh,
        left: bl + (parseFloat(cs.paddingLeft) || 0),
        atEnd,
    };
}
