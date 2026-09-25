import type { CSSProperties } from "react";
import styles from "./Splittext.module.css";

type Props = {
    text: string;
    /* Seconds before the first character moves. */
    start?: number;
    /* Seconds between consecutive characters. */
    step?: number;
    className?: string;
};

/* No hooks, no state — this stays a server component. The whole reveal is
   CSS, so it costs nothing on the client beyond the markup itself. */
export default function SplitText({
    text,
    start = 0,
    step = 0.03,
    className,
}: Props) {
    const words = text.split(" ");

    /* Counts across word boundaries so the second word doesn't restart the
       stagger from zero. */
    let i = 0;

    return (
        <span className={`${styles.root} ${className ?? ""}`} aria-hidden="true">
            {words.map((word, wi) => (
                <span key={wi} className={styles.word}>
                    {Array.from(word).map((char, ci) => {
                        const d = start + i * step;
                        i += 1;
                        return (
                            <span key={ci} className={styles.mask}>
                                <span
                                    className={styles.char}
                                    style={{ "--d": `${d.toFixed(3)}s` } as CSSProperties}
                                >
                                    {char}
                                </span>
                            </span>
                        );
                    })}
                </span>
            ))}
        </span>
    );
}