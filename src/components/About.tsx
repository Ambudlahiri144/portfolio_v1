"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { about } from "@/lib/site";
import { useInView } from "@/lib/useinview";
import styles from "./About.module.css";

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export default function About() {
    const { ref, inView } = useInView<HTMLElement>();

    return (
        <section
            id="about"
            ref={ref}
            className={styles.about}
            data-visible={inView || undefined}
        >
            <div className={styles.inner}>
                {/* ---- Text column ---- */}
                <div className={styles.copy}>
                    <p className={styles.eyebrow} style={delay(0)}>
                        <span className={styles.eyebrowRule} />
                        {about.eyebrow}
                    </p>

                    <h2 className={styles.heading} style={delay(0.08)}>
                        {about.heading}
                    </h2>

                    {about.body.map((para, i) => (
                        <p key={i} className={styles.para} style={delay(0.18 + i * 0.08)}>
                            {para}
                        </p>
                    ))}

                    <div className={styles.actions} style={delay(0.36)}>
                        <Link href="/experience" className={styles.btnSolid}>
                            Explore more
                            <svg
                                className={styles.arrow}
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M3.5 8h9M8.8 4.3 12.5 8l-3.7 3.7" />
                            </svg>
                        </Link>

                        <a href="#projects" className={styles.btnGhost}>
                            My Contributions
                        </a>
                    </div>
                </div>

                {/* ---- Portrait ---- */}
                <div className={styles.portraitCol} style={delay(0.14)}>
                    <div className={styles.portrait}>
                        <div className={styles.frame}>
                            {/* Both portraits sit in the DOM and cross-fade on opacity,
                  driven purely by the data-theme attribute. No JS, so the
                  correct one is already showing at first paint. */}
                            <Image
                                src={about.photoLight}
                                alt={about.photoAlt}
                                fill
                                sizes="(max-width: 48rem) 62vw, 340px"
                                className={`${styles.photo} ${styles.photoLight}`}
                            />
                            <Image
                                src={about.photoDark}
                                alt=""
                                aria-hidden="true"
                                fill
                                sizes="(max-width: 48rem) 62vw, 340px"
                                className={`${styles.photo} ${styles.photoDark}`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}