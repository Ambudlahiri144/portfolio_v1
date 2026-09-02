import type { CSSProperties } from "react";
import { site } from "@/lib/site";
import SplitText from "./Splittext";
import HeroCanvasMount from "./hero/HeroCanvasMount";
import styles from "./Hero.module.css";

const delay = (seconds: number) =>
    ({ "--d": `${seconds.toFixed(3)}s` }) as CSSProperties;

/* Timing map for the load sequence, in seconds. Kept in one place so the whole
   cascade can be retimed without hunting through the markup. */
const T = {
    status: 0.15,
    role: 0.28,
    nameStart: 0.45,
    charStep: 0.032,
    /* Beat between the last character landing and the tagline arriving. */
    afterName: 0.2,
};

export default function Hero() {
    /* "Ambud Lahiri" sets as two stacked lines. The character stagger has to
       keep counting across the break, otherwise the second line restarts from
       zero and the two halves visibly race each other. */
    const words = site.name.split(" ");

    /* Written as a prefix sum rather than a counter mutated inside the map.
       The React Compiler rejects reassigning a local from within a callback,
       and with two words the repeated slice costs nothing. */
    const charsBefore = (i: number) =>
        words.slice(0, i).reduce((n, w) => n + w.length, 0);

    const lines = words.map((word, i) => ({
        word,
        start: T.nameStart + charsBefore(i) * T.charStep,
    }));

    const totalChars = charsBefore(words.length);
    const taglineAt = T.nameStart + totalChars * T.charStep + T.afterName;

    return (
        <section id="top" className={styles.hero}>
            {/* Sits behind everything and is purely decorative. Renders nothing
                at all under reduced motion. */}
            <HeroCanvasMount />

            {/* The CSS field stays. It carries the hero on its own when the
                canvas is absent — reduced motion, no WebGL, or the seconds
                before three.js has loaded. */}
            <div className={styles.field} aria-hidden="true">
                <span className={styles.dots} />
                <span className={styles.glow} />
            </div>

            <div className={styles.inner}>
                <p className={styles.status} style={delay(T.status)}>
                    <span className={styles.dot} aria-hidden="true" />
                    {site.status}
                </p>

                <p className={styles.role} style={delay(T.role)}>
                    {site.role}
                </p>

                {/* aria-label carries the real name; the split spans are
                    decorative, so a screen reader never spells it out character
                    by character. */}
                <h1 className={styles.name} aria-label={site.name}>
                    {lines.map(({ word, start }) => (
                        <span key={word} className={styles.nameLine}>
                            <SplitText text={word} start={start} step={T.charStep} />
                        </span>
                    ))}
                </h1>

                <p className={styles.tagline} style={delay(taglineAt)}>
                    {site.tagline}
                </p>

                <a
                    href="#about"
                    className={styles.cue}
                    style={delay(taglineAt + 0.18)}
                >
                    <span className={styles.cueRule} aria-hidden="true" />
                    {site.scrollCue}
                </a>
            </div>
        </section>
    );
}
