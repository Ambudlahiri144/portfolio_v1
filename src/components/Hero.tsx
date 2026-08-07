import type { CSSProperties } from "react";
import { site } from "@/lib/site";
import styles from "./Hero.module.css";

const delay = (seconds: number) =>
    ({ "--d": `${seconds.toFixed(3)}s` }) as CSSProperties;

/* Timing map for the load sequence, in seconds. Kept in one place so the
   whole cascade can be retimed without hunting through the markup. */
const T = {
    greeting: 0.15,
    nameStart: 0.42,
    charStep: 0.032,
    lineGap: 0.14,
};

export default function Hero() {
    const words = site.name.split(" ");

    /* Character index keeps counting across word boundaries, otherwise the
       second word would restart the stagger from zero. */
    let charIndex = 0;

    /* Lines begin only after the last character has landed. */
    const nameChars = site.name.replace(/\s/g, "").length;
    const linesStart = T.nameStart + nameChars * T.charStep + 0.22;

    return (
        <section id="top" className={styles.hero}>
            <div className={styles.field} aria-hidden="true">
                <span className={styles.dots} />
                <span className={styles.glow} />
            </div>

            <div className={styles.inner}>
                <p className={styles.greeting} style={delay(T.greeting)}>
                    {site.greeting}
                </p>

                {/* aria-label carries the real name; the split spans are decorative,
            so a screen reader never spells it out character by character. */}
                <h1 className={styles.name} aria-label={site.name}>
                    {words.map((word, wi) => (
                        <span key={wi} className={styles.word} aria-hidden="true">
                            {Array.from(word).map((char, ci) => {
                                const d = T.nameStart + charIndex * T.charStep;
                                charIndex += 1;
                                return (
                                    <span key={ci} className={styles.mask}>
                                        <span className={styles.char} style={delay(d)}>
                                            {char}
                                        </span>
                                    </span>
                                );
                            })}
                        </span>
                    ))}
                </h1>

                <div className={styles.lines}>
                    {site.lines.map((line, i) => (
                        <p
                            key={i}
                            className={styles.line}
                            style={delay(linesStart + i * T.lineGap)}
                        >
                            {line}
                        </p>
                    ))}
                </div>
            </div>
        </section>
    );
}