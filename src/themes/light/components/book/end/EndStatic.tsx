import Link from "next/link";
import { endScene } from "@light/lib/site";
import GoLink from "../GoLink";
import styles from "./EndStatic.module.css";

/* ==================================================================
   END, UNBOUND — the last scene for phones and reduced motion.

   No video and no 3D: the still of the cat on the table, and under it
   the way back into the book as maple type blocks drawn in CSS (the
   same wood, bevel and letters as the 3D ones), then the colophon.
   ================================================================== */

export default function EndStatic({ still, children }: { still: string; children?: React.ReactNode }) {
    return (
        <div className={styles.end}>
            <figure className={styles.still}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={still} alt={endScene.stillAlt} loading="lazy" />
            </figure>
            <nav aria-label="Back into the book">
                <ul className={styles.blocks}>
                    {endScene.blocks.map((b) => (
                        <li key={b.label}>
                            {"href" in b ? (
                                <Link href={b.href} className={styles.block}>
                                    {b.label}
                                </Link>
                            ) : (
                                <GoLink to={b.anchor} className={styles.block}>
                                    {b.label}
                                </GoLink>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>
            {children}
        </div>
    );
}
