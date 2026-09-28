/* ------------------------------------------------------------------
   Everything you personalise in the LIGHT theme lives here.

   The light theme is a book read by scrolling: the cover, five open
   spreads, and the closed book again at the end. This file holds the
   words on those pages and the order they come in. The footage they sit
   on is described by public/book/manifest.json, which
   scripts/book-frames.mjs writes.

   Copy rule for this file: no em or en dashes in anything a visitor
   reads. Use a comma, a colon, or two sentences.
   ------------------------------------------------------------------ */

import { contactEmail } from "@/shared/contact";

export const site = {
    name: "Ambud Lahiri",
    role: "Full-stack Engineer",
    status: "Currently at Dataflow Group",
    tagline: "I ship products end to end, from schema to pixels and from idea to uptime.",
} as const;

/* ------------------------------------------------------------------
   THE BOOK

   The home page is one pinned stage scrubbed through this list, top to
   bottom. A `hold` is the book lying still with a spread's content on
   it; a `motion` plays a clip from the manifest. `vh` is how much
   scrolling each one takes, so it is the pacing: holds are sized for
   reading, motions for how long the movement should feel.

   Holds cost no frames at all. The canvas simply keeps showing the
   frame the previous motion ended on, which is why a whole site of page
   turns weighs less than one of the dark theme's sequences.

   `anchor` places an id at the point in the scroll where that spread is
   fully on the page. The dock, the footer and /experience's back link
   jump to these.
   ------------------------------------------------------------------ */

export type BookClip = "open" | "turnA" | "turnB";

export type SpreadId =
    | "cover"
    | "about"
    | "work"
    | "projects-1"
    | "projects-2"
    | "contact"
    | "closed";

export type BookSegment =
    | { kind: "hold"; spread: SpreadId; vh: number; anchor?: string }
    | { kind: "motion"; clip: BookClip; reverse?: boolean; vh: number };

/* The two page turns alternate. Blank pages make every turn look alike,
   and alternating two different takes is what keeps that from showing. */
export const bookTimeline: BookSegment[] = [
    { kind: "hold", spread: "cover", vh: 60, anchor: "top" },
    { kind: "motion", clip: "open", vh: 130 },
    { kind: "hold", spread: "about", vh: 150, anchor: "about" },
    { kind: "motion", clip: "turnA", vh: 100 },
    { kind: "hold", spread: "work", vh: 150, anchor: "work" },
    { kind: "motion", clip: "turnB", vh: 80 },
    { kind: "hold", spread: "projects-1", vh: 150, anchor: "projects" },
    { kind: "motion", clip: "turnA", vh: 100 },
    { kind: "hold", spread: "projects-2", vh: 150 },
    { kind: "motion", clip: "turnB", vh: 80 },
    { kind: "hold", spread: "contact", vh: 190, anchor: "contact" },
    /* Closing the book is the opening played backwards. */
    { kind: "motion", clip: "open", reverse: true, vh: 120 },
    { kind: "hold", spread: "closed", vh: 80 },
];

/* The cover. The name goes on the book's own debossed title panel; the
   rest sits on the tablecloth to its left. */
export const cover = {
    lead: "Portfolio of",
    title: site.name,
    role: site.role,
    body: "Full-stack engineer with a bias for shipping. React and Next.js on the front, Node, Python and AWS behind it, and a real user at the end of every build.",
    cta: "Open the book",
} as const;

export const about = {
    /* Left page: one line, set large. */
    opening: "I build the whole thing, not just the part that shows.",
    /* Right page. */
    heading: "About",
    body: [
        "I work across the stack, from database schema to the last few pixels of a hover state. Most of what I build lives in TypeScript, React and Next.js, sitting on Node and Postgres.",
        "What I care about is the part users feel: pages that load before they notice, interfaces that behave the way they expect, and systems that stay boring under load.",
    ],
    status: site.status,
    more: { label: "The full record", href: "/experience" },
} as const;

export type NavItem = {
    id: string;
    label: string;
    href: string;
    icon: "home" | "about" | "work" | "projects" | "contact";
};

/* Root-relative so the dock still works from /experience. */
export const nav: NavItem[] = [
    { id: "home", label: "Cover", href: "/#top", icon: "home" },
    { id: "about", label: "About", href: "/#about", icon: "about" },
    { id: "work", label: "Work", href: "/#work", icon: "work" },
    { id: "projects", label: "Projects", href: "/#projects", icon: "projects" },
    { id: "contact", label: "Contact", href: "/#contact", icon: "contact" },
];

/* ------------------------------------------------------------------
   Work, education and stacks. The book's work spread shows these, and
   /experience shows them in full.
   ------------------------------------------------------------------ */

/* Every stack /experience can highlight. `id` is what entries reference. */
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
    tech: TechId[];
};

/* Most recent first: a reader of a CV wants the present before the past. */
export const work: TimelineEntry[] = [
    {
        period: "May 2026 to now",
        title: "Software Engineer Intern",
        org: "Dataflow Group",
        detail:
            "Architected a serverless AWS AI pipeline that automates 80% of processing, cutting turnaround by 45% and lifting routing accuracy by 35%.",
        tech: ["aws", "python"],
    },
    {
        period: "Aug 2025 to Apr 2026",
        title: "Full-Stack Developer Intern",
        org: "Syntalix",
        detail:
            "Built a React Native crowdfunding platform with a 90% payment success rate, cut Django latency by 60%, and led a React and Tailwind redesign.",
        tech: ["react", "expo", "django", "python", "tailwind", "javascript"],
    },
];

export const education: TimelineEntry[] = [
    {
        period: "Aug 2022 to Jun 2026",
        title: "B.Tech, Computer Science (Artificial Intelligence)",
        org: "Bennett University",
        detail: "CGPA 9.27.",
        tech: ["python", "java", "cpp"],
    },
    {
        period: "2020 to 2022",
        title: "Class XII, Senior Secondary",
        org: "Delhi Public School, CBSE",
        detail: "",
        tech: ["cpp"],
    },
    {
        period: "2007 to 2020",
        title: "Class X, Secondary",
        org: "Vivekananda Mission School, ICSE",
        detail: "",
        tech: [],
    },
];

export const workSpread = {
    workHeading: "Work",
    educationHeading: "Education",
} as const;

/* ------------------------------------------------------------------
   Projects. Two to a spread, so four projects are two page turns.
   ------------------------------------------------------------------ */

export type Project = {
    title: string;
    kind: string;
    detail: string;
    /* Plain strings: a project's stack is a label on a page, not an id. */
    tech: string[];
    /* Shown as the print tipped onto the page. WebP, in /public/projects. */
    image: string;
    repo?: string;
};

export const projects: Project[] = [
    {
        title: "Murmur",
        repo: "https://github.com/Ambudlahiri144/Murmur",
        image: "/projects/murmur.webp",
        kind: "Social platform",
        detail:
            "A MERN social network with JWT-secured APIs, live Socket.IO messaging and notifications, and in-browser video processing that made uploads 75% faster.",
        tech: ["React", "Tailwind CSS", "Node.js", "Express", "Socket.IO", "MongoDB"],
    },
    {
        title: "Bail Reckoner",
        repo: "https://github.com/Ambudlahiri144/Sudo_bail",
        image: "/projects/bail.webp",
        kind: "Legal decision support",
        detail:
            "Case-law retrieval for legal professionals: a Next.js interface over FastAPI services, matching precedents in real time against a Llama 3.1 backed database.",
        tech: ["Next.js", "Django", "Python", "Llama 3.1", "FastAPI"],
    },
    {
        title: "BU-GPT",
        repo: "https://github.com/Ambudlahiri144/BU-GPT",
        image: "/projects/bu.webp",
        kind: "Mobile AI assistant",
        detail:
            "A Flutter assistant that answers questions against your own documents, with OpenAI conversation behind Firebase auth. It cut manual document analysis by 90%.",
        tech: ["Flutter", "Dart", "OpenAI API", "Firebase"],
    },
    {
        title: "Kine-sense",
        repo: "https://github.com/Ambudlahiri144/Kine-sense",
        image: "/projects/kine.webp",
        kind: "Video analytics",
        detail:
            "A video analytics platform that sorts 95% of ingested YouTube content automatically, then runs live engagement inference through Django Channels.",
        tech: ["Streamlit", "Django", "Python", "SQLite", "Daphne", "YouTube API"],
    },
];

export const projectsSpread = {
    heading: "Selected work",
    repoLabel: "Read the source",
} as const;

/* ------------------------------------------------------------------
   Contact
   ------------------------------------------------------------------ */

/* Which field a visitor is hiring for. Lives in src/shared because
   /api/verify validates against it. */
export { hireFields, type HireField } from "@/shared/contact";

export const contactSpread = {
    heading: "Write to me",
    body: "Feedback on the site, a project, a role, or something else entirely. Every message is read, and most are answered within a day.",
    direct: "Or write directly to",
} as const;

export const contactForm = {
    heading: "Drop a message",

    /* Where everything this form sends is delivered. Defined in src/shared
       so the API routes read the same value. */
    email: contactEmail,

    submit: "Send message",

    tabs: [
        {
            id: "feedback",
            label: "Feedback",
            title: "How did the book read?",
            blurb:
                "Anything that felt good, anything that broke, anything you would have done differently. Blunt is fine.",
            messageLabel: "Your comment",
        },
        {
            id: "connect",
            label: "Connect",
            title: "Start a conversation",
            blurb:
                "A proposal, a project, a question, or something entirely unrelated. All of it is welcome.",
            messageLabel: "Your message",
        },
        {
            id: "hire",
            label: "Hire me",
            title: "Let's talk about the role",
            blurb: "Pick how you would be bringing me on, and take the CV with you.",
            messageLabel: "Your message",
        },
    ],

    hire: {
        freelance: {
            label: "As a freelancer",
            blurb:
                "Project work, a fixed scope, or an extra pair of hands for a sprint. Take the CV, and tell me what you need built.",
            /* The same file as the SDE CV: freelance work is the same
               engineering, sold differently. */
            resume: "/Ambud_Resume_SDE-1.pdf",
            resumeLabel: "Freelance CV",
        },
        employee: {
            label: "As an employee",
            blurb:
                "Tell me which side of the stack the role sits on and I will send you the CV written for it.",
            question: "Which field are you hiring for?",
            verifyBlurb:
                "The CV goes to a verified address, so I know who I am talking to. Enter your email and I will send a six-digit code.",
            othersLabel: "In what capacity are you hiring?",
            othersNote:
                "Send the job requirements in detail and I will be in touch shortly with the resume that fits.",
        },
    },

    fields: {
        name: "Name",
        email: "Email",
        topic: "Topic",
        message: "Your message",
    },
} as const;

/* ------------------------------------------------------------------
   The closed book: the footer, set on the tablecloth beside it.
   ------------------------------------------------------------------ */

export type SocialLink = {
    id: "github" | "linkedin" | "instagram" | "leetcode";
    label: string;
    /* Empty means "not supplied yet": listed, dimmed, not a link. */
    href: string;
};

export const social: SocialLink[] = [
    { id: "github", label: "GitHub", href: "https://github.com/Ambudlahiri144" },
    { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/ambud-lahiri/" },
    { id: "instagram", label: "Instagram", href: "https://www.instagram.com/ambudlahiri_004/" },
    { id: "leetcode", label: "LeetCode", href: "https://leetcode.com/u/Ambudlahiri144/" },
];

export const footer = {
    heading: "Thank you for reading.",
    /* Public by decision: it is already printed on every CV the Hire tab
       hands out. */
    email: contactEmail,
    backToTop: "Back to the cover",
    fullRecord: { label: "The full record", href: "/experience" },
    colophon: "Set in Cormorant Garamond and Literata. Built with Next.js.",
} as const;
