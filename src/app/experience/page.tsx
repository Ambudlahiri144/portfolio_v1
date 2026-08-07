import type { Metadata } from "next";
import Link from "next/link";
import { site, work, education, type TimelineEntry } from "@/lib/site";
import styles from "./experience.module.css";

export const metadata: Metadata = {
    title: `Experience — ${site.name}`,
    description: "Work experience and academic background.",
};

function Timeline({
    label,
    entries,
}: {
    label: string;
    entries: TimelineEntry[];
}) {
    return (
        <section className={styles.group}>
            <h2 className={styles.groupLabel}>{label}</h2>

            <ol className={styles.list}>
                {entries.map((entry, i) => (
                    <li key={i} className={styles.entry}>
                        <span className={styles.node} aria-hidden="true" />
                        <p className={styles.period}>{entry.period}</p>
                        <h3 className={styles.role}>{entry.title}</h3>
                        <p className={styles.org}>{entry.org}</p>
                        <p className={styles.detail}>{entry.detail}</p>
                    </li>
                ))}
            </ol>
        </section>
    );
}

export default function ExperiencePage() {
    return (
        <main id="main" className={styles.page}>
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

                <h1 className={styles.title}>Experience</h1>
                <p className={styles.lede}>
                    Where I have worked, and what I studied before that.
                </p>

                <Timeline label="Work" entries={work} />
                <Timeline label="Education" entries={education} />
            </div>
        </main>
    );
}