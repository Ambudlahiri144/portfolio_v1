"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@light/lib/useReducedMotion";
import type { SentLetter } from "./ContactForm";
import styles from "./Envelope.module.css";

/* ==================================================================
   ENVELOPE — the letter you just wrote, folded, sealed and sent.

   Plays once, on a successful send, over the page the form was on:

     0.0-1.0s  the letter folds in thirds
     1.0-1.6s  it drops into the envelope's pocket
     1.9-2.5s  the flap swings shut
     2.5-3.1s  the wax seal is pressed on
     3.4-4.2s  the envelope slides off the fore-edge
     4.2s      "Sent. Thank you." inks onto the empty page

   All CSS 3D on one timeline (Envelope.module.css). The camera is
   overhead here, so a CSS perspective is the right tool; there is no
   WebGL in it. Reduced motion skips straight to the note.
   ================================================================== */

const DONE_AT = 4300;

export default function Envelope({ letter, onAgain }: { letter: SentLetter; onAgain: () => void }) {
    const reduced = useReducedMotion();
    const [done, setDone] = useState(reduced);

    useEffect(() => {
        if (reduced) return;
        const t = window.setTimeout(() => setDone(true), DONE_AT);
        return () => window.clearTimeout(t);
    }, [reduced]);

    return (
        <div className={styles.stage}>
            {!reduced && (
                <div className={styles.scene} aria-hidden="true">
                    <div className={styles.envelope}>
                        {/* Back to front: the open flap, the letter, the
                            pocket. The letter slides down behind the pocket. */}
                        <div className={styles.flap}>
                            <span className={styles.flapInside} />
                            <span className={styles.flapOutside} />
                        </div>
                        <div className={styles.letter}>
                            <div className={`${styles.third} ${styles.top}`}>
                                <span className={styles.face}>
                                    <span className={styles.salutation}>Dear Ambud,</span>
                                </span>
                                <span className={styles.back} />
                            </div>
                            <div className={`${styles.third} ${styles.middle}`}>
                                <span className={styles.face}>
                                    <span className={styles.excerpt}>{letter.message}</span>
                                </span>
                            </div>
                            <div className={`${styles.third} ${styles.bottom}`}>
                                <span className={styles.face}>
                                    <span className={styles.signature}>{letter.name}</span>
                                </span>
                                <span className={styles.back} />
                            </div>
                        </div>
                        <div className={styles.pocket} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className={styles.seal} src="/book/props/wax-seal.webp" alt="" />
                    </div>
                </div>
            )}

            {done && (
                <div className={styles.note} role="status">
                    <p className={styles.noteTitle}>Sent. Thank you.</p>
                    <p className={styles.noteBody}>
                        Your letter is on its way{letter.name ? `, ${letter.name.split(" ")[0]}` : ""}. I read
                        every one, and most get a reply within a day.
                    </p>
                    <button type="button" className={styles.again} onClick={onAgain}>
                        Write another
                    </button>
                </div>
            )}
        </div>
    );
}
