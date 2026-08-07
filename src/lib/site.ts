/* ------------------------------------------------------------------
   Everything you personalise lives here.
   ------------------------------------------------------------------ */

export const site = {
    name: "Ambud Lahiri",
    greeting: "Hi",
    lines: [
        "I ship products end to end — schema to pixels, idea to uptime.",
        "Full-stack engineer who thinks like a product designer.",
    ],
} as const;

export const about = {
    eyebrow: "About",
    heading: "I build the whole thing, not just the part that shows.",
    /* Two short paragraphs. Concrete beats adjectives — say what you have
       actually shipped rather than that you are passionate about shipping. */
    body: [
        "I work across the stack, from database schema to the last few pixels of a hover state. Most of what I build lives in TypeScript, React and Next.js, sitting on Node and Postgres.",
        "What I care about is the part users feel: pages that load before they notice, interfaces that behave the way they expect, and systems that stay boring under load.",
    ],
    /* Drop your two portraits into /public with these exact names. */
    photoLight: "/light.png",
    photoDark: "/dark.png",
    photoAlt: "Portrait of Ambud Lahiri",
} as const;

export type NavItem = {
    id: string;
    label: string;
    href: string;
    icon: "home" | "about" | "projects" | "contact";
};

/* Root-relative so the dock still works from /experience or any other
   route — a bare "#about" would resolve against the current path. */
export const nav: NavItem[] = [
    { id: "home", label: "Home", href: "/#top", icon: "home" },
    { id: "about", label: "About", href: "/#about", icon: "about" },
    { id: "projects", label: "Projects", href: "/#projects", icon: "projects" },
    { id: "contact", label: "Contact", href: "/#contact", icon: "contact" },
];

/* ------------------------------------------------------------------
   /experience — replace with your real entries
   ------------------------------------------------------------------ */

export type TimelineEntry = {
    period: string;
    title: string;
    org: string;
    detail: string;
};

export const work: TimelineEntry[] = [
    {
        period: "2024 — Present",
        title: "Your Role",
        org: "Company Name",
        detail:
            "One or two lines on what you owned and what changed because of it. Numbers land harder than adjectives.",
    },
    {
        period: "2023 — 2024",
        title: "Your Role",
        org: "Company Name",
        detail: "What you built, and the constraint that made it interesting.",
    },
];

export const education: TimelineEntry[] = [
    {
        period: "2021 — 2025",
        title: "B.Tech, Computer Science",
        org: "Your University",
        detail: "Coursework, thesis, or anything you'd actually want asked about.",
    },
];