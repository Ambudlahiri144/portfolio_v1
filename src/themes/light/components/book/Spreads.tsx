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
    projects,
    projectsSpread,
    social,
    work,
    workSpread,
    type Project,
    type SpreadId,
    type TimelineEntry,
} from "@light/lib/site";
import ContactForm from "../contact/ContactForm";
import GoLink from "./GoLink";
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
        <span className={styles.label} aria-hidden="true">
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
function ProjectPage({ project, printLast = false }: { project: Project; printLast?: boolean }) {
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
                <GoLink to="about" className={styles.cta}>
                    {cover.cta}
                </GoLink>
            </div>
        ),
    },

    about: {
        left: (
            <div className={styles.opening}>
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
                <h2 className={styles.pageHeading}>{workSpread.educationHeading}</h2>
                <ul className={styles.entries}>
                    {education.map((e) => (
                        <Entry key={e.org} entry={e} />
                    ))}
                </ul>
            </div>
        ),
    },

    "projects-1": {
        left: <ProjectPage project={projects[0]} />,
        right: <ProjectPage project={projects[1]} printLast />,
    },

    "projects-2": {
        left: <ProjectPage project={projects[2]} />,
        right: <ProjectPage project={projects[3]} printLast />,
    },

    contact: {
        left: (
            <div className={styles.formPage}>
                <ContactForm />
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
                <h2 className={styles.colophonTitle}>{footer.heading}</h2>
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
                <GoLink to="top" className={styles.cta}>
                    {footer.backToTop}
                </GoLink>
                <p className={styles.colophonNote}>{footer.colophon}</p>
            </footer>
        ),
    },
};
