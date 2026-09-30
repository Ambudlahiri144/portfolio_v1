/* ==================================================================
   THE BOOK, UNBOUND — reduced motion and portrait screens.

   No pinning, no canvas, no frame download. The cover is one still of
   the closed book with the name on its panel, and every spread follows
   as ordinary paper sheets in reading order. The anchors are real
   sections here, so the dock and every in-page link simply scroll.
   ================================================================== */

import { holds, manifest, rect } from "./timeline";
import { projects } from "@light/lib/site";
import { ProjectPage, spreads } from "./Spreads";
import { frameUrl } from "./useBookFrames";
import EndStatic from "./end/EndStatic";
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
                .filter((h) => h.spread !== "cover" && h.spread !== "projects-intro")
                .map((h) => {
                    /* Without the 3D pop-up, the projects are sheets like
                       every other page, two to a row. */
                    if (h.spread === "popup") {
                        return (
                            <section key={h.spread} id={h.anchor} className={styles.spread}>
                                {projects.map((p) => (
                                    <div key={p.title} className={styles.sheet}>
                                        <ProjectPage project={p} />
                                    </div>
                                ))}
                            </section>
                        );
                    }
                    /* The cat's last scene: her still and the way back. */
                    if (h.spread === "end") {
                        return (
                            <section key={h.spread} id={h.anchor} className={styles.spread}>
                                <div className={styles.table}>
                                    <EndStatic still="/book/cat/end-still.webp">{spreads.end.endText}</EndStatic>
                                </div>
                            </section>
                        );
                    }
                    const s = spreads[h.spread];
                    /* The contact spread's right page is the stationery to
                       choose from, so unbound it comes first. */
                    const pages = h.spread === "contact" ? [s.right, s.left] : [s.left, s.right];
                    return (
                        <section key={h.spread} id={h.anchor} className={styles.spread}>
                            {pages.map((p, i) => p && <div key={i} className={styles.sheet}>{p}</div>)}
                            {s.table && <div className={styles.table}>{s.table}</div>}
                        </section>
                    );
                })}
        </div>
    );
}
