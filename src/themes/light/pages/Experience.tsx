import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@light/lib/site";
import Shelf from "@light/components/shelf/Shelf";
import styles from "./experience.module.css";

export const metadata: Metadata = {
    title: `The full record, ${site.name}`,
    description: "Work experience and academic background, as volumes on a shelf.",
};

/* The book's appendix: every job and every school, one volume each, on a
   shelf. Take one down to read it. */
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
                    Back to the book
                </Link>

                <h1 className={styles.title}>The full record</h1>
                <p className={styles.lede}>Where I have worked, and what I studied before that, a volume each.</p>

                <Shelf />
            </div>
        </main>
    );
}
