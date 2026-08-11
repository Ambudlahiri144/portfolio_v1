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
   /experience
   ------------------------------------------------------------------ */

/* Every stack shown on the globe. `id` is what timeline entries
   reference; the icon for each id is mapped in TechGlobe.tsx. */
export const tech = [
    { id: "react", label: "React" },
    { id: "nextjs", label: "Next.js" },
    { id: "typescript", label: "TypeScript" },
    { id: "javascript", label: "JavaScript" },
    { id: "nodejs", label: "Node.js" },
    { id: "express", label: "Express" },
    { id: "mongodb", label: "MongoDB" },
    { id: "python", label: "Python" },
    { id: "django", label: "Django" },
    { id: "fastapi", label: "FastAPI" },
    { id: "tailwind", label: "Tailwind CSS" },
    { id: "expo", label: "Expo" },
    { id: "socketio", label: "Socket.IO" },
    { id: "aws", label: "AWS" },
    { id: "java", label: "Java" },
    { id: "flutter", label: "Flutter" },
    { id: "git", label: "Git" },
    { id: "cpp", label: "C++" },
] as const;

export type TechId = (typeof tech)[number]["id"];

export type TimelineEntry = {
    period: string;
    title: string;
    org: string;
    detail: string;
    /* Highlighted on the globe when this entry is selected. */
    tech: TechId[];
};

export const work: TimelineEntry[] = [
    {
        period: "Aug 2025 — April 2026",
        title: "Full-Stack Developer Intern",
        org: "Syntalix",
        detail:
            "Built React Native crowdfunding platform with 90% payment success. Cut Django latency 60% and led React/Tailwind UX redesign.",
        tech: ["react", "expo", "django", "python", "tailwind", "javascript"],
    },
    {
        period: "May 2026 — Present",
        title: "Software Engineer Intern",
        org: "Dataflow Group",
        detail:
            "Architected serverless AWS AI pipeline, automating 80% of processing, cutting turnaround 45%, and lifting routing accuracy 35%.",
        tech: ["aws", "python"],
    },
];

export const education: TimelineEntry[] = [
    {
        period: "2007 — 2020",
        title: "Class X, Secondary",
        org: "Vivekananda Mission School — ICSE",
        detail: "",
        tech: [],
    },
    {
        period: "2020 — 2022",
        title: "Class XII, Senior Secondary",
        org: "Delhi Public School — CBSE",
        detail: "",
        tech: ["cpp"],
    },
    {
        period: "Aug 2022 — June 2026",
        title: "B.Tech, Computer Science (Artificial Intelligence)",
        org: "Bennett University",
        detail: "CGPA 9.27.",
        tech: ["python", "java", "cpp"],
    },
];