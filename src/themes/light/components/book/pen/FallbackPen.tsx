/* The pen, drawn, for until the photographed one exists
   (assets-src/book/props/pen.png, made into public/book/props/pen.webp
   by scripts/book-props.mjs). The same conventions as that sprite's
   pen.json: nib tip at (0, 36), barrel along +x, 1000 units long. */

export const FALLBACK = { w: 1000, h: 72, tip: [0, 36] as [number, number], angle: 0, length: 1000 };

export default function FallbackPen() {
    return (
        <svg width={FALLBACK.w} height={FALLBACK.h} viewBox="0 0 1000 72" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id="pen-gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f3dca0" />
                    <stop offset="0.45" stopColor="#c89b4a" />
                    <stop offset="1" stopColor="#7a5a24" />
                </linearGradient>
                <linearGradient id="pen-black" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4a423c" />
                    <stop offset="0.28" stopColor="#1b1714" />
                    <stop offset="0.7" stopColor="#0c0a09" />
                    <stop offset="1" stopColor="#2a241f" />
                </linearGradient>
            </defs>
            {/* Nib: a two-tone point with its slit and breather hole. */}
            <path d="M0 36 L118 18 Q150 17 158 22 L158 50 Q150 55 118 54 Z" fill="url(#pen-gold)" />
            <path d="M40 30 L118 22 L118 50 L40 42 Z" fill="#e9e2d6" opacity="0.55" />
            <path d="M6 36 L112 36" stroke="#3b2a14" strokeWidth="1.6" />
            <circle cx="112" cy="36" r="3.4" fill="#3b2a14" />
            {/* Section, ring, barrel, and the end with its band. */}
            <rect x="152" y="17" width="112" height="38" rx="8" fill="url(#pen-black)" />
            <rect x="262" y="13" width="14" height="46" rx="2" fill="url(#pen-gold)" />
            <rect x="274" y="11" width="690" height="50" rx="22" fill="url(#pen-black)" />
            <rect x="290" y="17" width="650" height="5" rx="2.5" fill="#fff" opacity="0.16" />
            <rect x="890" y="11" width="12" height="50" fill="url(#pen-gold)" />
            <path d="M960 11 Q1000 16 1000 36 Q1000 56 960 61 Z" fill="url(#pen-black)" />
        </svg>
    );
}
