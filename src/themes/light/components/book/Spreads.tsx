/* ==================================================================
   SPREADS — the words on each page of the book.

   Pure markup. Where it goes (on the canvas' pages, or stacked as paper
   sheets for reduced motion and portrait screens) is the caller's
   business, so both layouts read the same content and cannot drift.

   Each spread fills some of four slots:
     left, right  the two pages of an open spread
     table        the tablecloth beside the closed book
     label        the cover's debossed title panel
   ================================================================== */

import type { ReactNode } from "react";
import Link from "next/link";
import {
    about,
    contactSpread,
    cover,
    education,
    footer,
    nav,
    projectsSpread,
    social,
    work,
    workSpread,
    type Project,
    type SpreadId,
    type TimelineEntry,
} from "@light/lib/site";
import LetterPage from "../contact/LetterPage";
import GoLink from "./GoLink";
import PeelPhoto from "./PeelPhoto";
import Guilloche from "../Guilloche";
import styles from "./Spreads.module.css";

export type SpreadSlots = {
    left?: ReactNode;
    right?: ReactNode;
    table?: ReactNode;
    label?: ReactNode;
};

/* The name on the cloth. Decorative: the real heading is the h1 beside the
   book, and a screen reader should not hear the name twice. */
function Label() {
    return (
        <span className={`${styles.label} ${styles.foil}`} aria-hidden="true">
            {cover.title}
        </span>
    );
}

function Entry({ entry }: { entry: TimelineEntry }) {
    return (
        <li className={styles.entry}>
            <span className={styles.period}>{entry.period}</span>
            <h3 className={styles.entryTitle}>{entry.title}</h3>
            <span className={styles.org}>{entry.org}</span>
            {entry.detail && <p className={styles.entryDetail}>{entry.detail}</p>}
        </li>
    );
}

/* A project on one page. `printLast` puts the photo at the foot of the page
   instead of the head, which is how the right-hand page keeps its lower
   left clear of the ribbon lying across it. */
export function ProjectPage({ project, printLast = false }: { project: Project; printLast?: boolean }) {
    const print = (
        <figure className={printLast ? styles.printLow : styles.print}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.image} alt={`${project.title}, screenshot`} loading="lazy" />
        </figure>
    );
    return (
        <article className={styles.project}>
            {!printLast && print}
            <span className={styles.kind}>{project.kind}</span>
            <h3 className={styles.projectTitle}>{project.title}</h3>
            <p className={styles.projectDetail}>{project.detail}</p>
            <ul className={styles.stack} aria-label="Built with">
                {project.tech.map((t) => (
                    <li key={t}>{t}</li>
                ))}
            </ul>
            {project.repo && (
                <a className={styles.link} href={project.repo} target="_blank" rel="noreferrer">
                    {projectsSpread.repoLabel}
                    <span className={styles.visuallyHidden}>: {project.title} on GitHub</span>
                </a>
            )}
            {printLast && print}
        </article>
    );
}

export const spreads: Record<SpreadId, SpreadSlots> = {
    cover: {
        label: <Label />,
        table: (
            <div className={styles.coverText}>
                <span className={styles.lead}>{cover.lead}</span>
                <h1 className={styles.coverTitle}>{cover.title}</h1>
                <span className={styles.role}>{cover.role}</span>
                <p className={styles.coverBody}>{cover.body}</p>
                <GoLink to="about" className={`${styles.cta} ink`}>
                    {cover.cta}
                </GoLink>
            </div>
        ),
    },

    about: {
        left: (
            <div className={about.photo.src ? styles.openingWithPhoto : styles.opening}>
                {about.photo.src && (
                    <PeelPhoto
                        src={about.photo.src}
                        linesSrc={about.photo.lines}
                        alt={about.photo.alt}
                        note={about.photo.note}
                    />
                )}
                <p className={styles.openingLine}>{about.opening}</p>
            </div>
        ),
        right: (
            <div className={styles.flow}>
                <h2 className={styles.pageHeading}>{about.heading}</h2>
                {about.body.map((p) => (
                    <p key={p} className={styles.body}>
                        {p}
                    </p>
                ))}
                <p className={styles.status}>
                    <span className={styles.statusDot} aria-hidden="true" />
                    {about.status}
                </p>
                <Link href={about.more.href} className={styles.link}>
                    {about.more.label}
                </Link>
            </div>
        ),
    },

    work: {
        left: (
            <div className={styles.flow}>
                <h2 className={styles.pageHeading}>{workSpread.workHeading}</h2>
                <ul className={styles.entries}>
                    {work.map((e) => (
                        <Entry key={e.org} entry={e} />
                    ))}
                </ul>
            </div>
        ),
        right: (
            <div className={styles.flow}>
                <div className={styles.headingWithSeal}>
                    <h2 className={styles.pageHeading}>{workSpread.educationHeading}</h2>
                    <Guilloche preset="seal" size={56} />
                </div>
                <ul className={styles.entries}>
                    {education.map((e) => (
                        <Entry key={e.org} entry={e} />
                    ))}
                </ul>
            </div>
        ),
    },

    /* The page before the camera comes down to the pop-up. */
    "projects-intro": {
        left: (
            <div className={styles.opening}>
                <h2 className={styles.openingLine}>{projectsSpread.heading}</h2>
            </div>
        ),
        right: (
            <div className={styles.flow}>
                <p className={styles.body}>{projectsSpread.invite}</p>
            </div>
        ),
    },

    /* The pop-up spread has no page content of its own: PopupLayer puts the
       projects in 3D on it. Unbound (BookStatic), it is the four project
       sheets instead. */
    popup: {},

    contact: {
        left: (
            <div className={styles.formPage}>
                <LetterPage />
            </div>
        ),
        right: (
            <div className={styles.flow}>
                <h2 className={styles.pageHeading}>{contactSpread.heading}</h2>
                <p className={styles.body}>{contactSpread.body}</p>
                <p className={styles.direct}>
                    {contactSpread.direct}{" "}
                    <a className={styles.link} href={`mailto:${footer.email}`}>
                        {footer.email}
                    </a>
                </p>
            </div>
        ),
    },

    closed: {
        label: <Label />,
        table: (
            <footer className={styles.colophon}>
                <h2 className={`${styles.colophonTitle} ${styles.foil}`}>{footer.heading}</h2>
                <nav aria-label="Chapters" className={styles.colophonNav}>
                    <ul>
                        {nav.slice(1).map((n) => (
                            <li key={n.id}>
                                <GoLink to={n.href.split("#")[1]}>{n.label}</GoLink>
                            </li>
                        ))}
                        <li>
                            <Link href={footer.fullRecord.href}>{footer.fullRecord.label}</Link>
                        </li>
                    </ul>
                </nav>
                <ul className={styles.social} aria-label="Elsewhere">
                    {social.map((s) => (
                        <li key={s.id}>
                            {s.href ? (
                                <a href={s.href} target="_blank" rel="noreferrer">
                                    {s.label}
                                </a>
                            ) : (
                                <span aria-disabled="true">{s.label}</span>
                            )}
                        </li>
                    ))}
                    <li>
                        <a href={`mailto:${footer.email}`}>Email</a>
                    </li>
                </ul>
                <GoLink to="top" className={`${styles.cta} ink`}>
                    {footer.backToTop}
                </GoLink>
                <div className={styles.bookplate}>
                    <Guilloche preset="plate" size={64} />
                    <p>
                        <span className={styles.exLibris}>Ex libris</span>
                        <span className={styles.bookplateName}>{footer.bookplate}</span>
                    </p>
                </div>
                <p className={styles.colophonNote}>{footer.colophon}</p>
            </footer>
        ),
    },
};
