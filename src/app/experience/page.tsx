import type { Metadata } from "next";
import Link from "next/link";
import { site, work, education } from "@/lib/site";
import SplitText from "@/components/Splittext";
import ExperienceTabs from "@/components/Experiencetabs";
import styles from "./experience.module.css";

export const metadata: Metadata = {
    title: `Experience — ${site.name}`,
    description: "Work experience and academic background.",
};

export default function ExperiencePage() {
    return (
        <main id="main" className={styles.page}>
            <div className={styles.field} aria-hidden="true">
                <span className={styles.dots} />
                <span className={styles.glow} />
            </div>

            <div className={styles.inner}>
                <Link href="/#about" className={styles.back}>
                    <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12.5 8h-9M7.2 4.3 3.5 8l3.7 3.7" />
                    </svg>
                    Back
                </Link>

                {/* aria-label carries the real text; the split spans are decorative,
            so a screen reader never spells it out character by character. */}
                <h1 className={styles.title} aria-label="Experience">
                    <SplitText text="Experience" start={0.22} step={0.038} />
                </h1>

                <p className={styles.lede}>
                    Where I have worked, and what I studied before that.
                </p>

                <ExperienceTabs work={work} education={education} />
            </div>
        </main>
    );
}