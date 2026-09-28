/* ==================================================================
   THE BOOK, UNBOUND — reduced motion and portrait screens.

   No pinning, no canvas, no frame download. The cover is one still of
   the closed book with the name on its panel, and every spread follows
   as ordinary paper sheets in reading order. The anchors are real
   sections here, so the dock and every in-page link simply scroll.
   ================================================================== */

import { holds, manifest, rect } from "./timeline";
import { spreads } from "./Spreads";
import { frameUrl } from "./useBookFrames";
import styles from "./BookStatic.module.css";

const G = manifest.geometry;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export default function BookStatic() {
    const [lx, ly, lw, lh] = rect(G.coverLabel);
    const cover = spreads.cover;

    return (
        <div className={styles.unbound}>
            <section id="top" className={styles.cover}>
                <div className={styles.coverFrame}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={frameUrl("open", 0, "md")}
                        alt="A clothbound book, closed, on a linen tablecloth"
                        width={manifest.width}
                        height={manifest.height}
                        fetchPriority="high"
                    />
                    <div
                        className={styles.label}
                        style={{
                            left: pct(lx, manifest.width),
                            top: pct(ly, manifest.height),
                            width: pct(lw, manifest.width),
                            height: pct(lh, manifest.height),
                        }}
                    >
                        {cover.label}
                    </div>
                </div>
                <div className={styles.coverText}>{cover.table}</div>
            </section>

            {holds
                .filter((h) => h.spread !== "cover")
                .map((h) => {
                    const s = spreads[h.spread];
                    return (
                        <section key={h.spread} id={h.anchor} className={styles.spread}>
                            {s.left && <div className={styles.sheet}>{s.left}</div>}
                            {s.right && <div className={styles.sheet}>{s.right}</div>}
                            {s.table && <div className={styles.table}>{s.table}</div>}
                        </section>
                    );
                })}
        </div>
    );
}
