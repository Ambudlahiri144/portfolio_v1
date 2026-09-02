/* ------------------------------------------------------------------
   Everything you personalise lives here.
   ------------------------------------------------------------------ */

export const site = {
    name: "Ambud Lahiri",

    /* Shown in the hero's status rail beside a live dot. Keep this factual —
       it is the first concrete claim on the page. It currently mirrors the
       open-ended entry in `work` below; change both together. */
    status: "Currently at Dataflow Group",

    /* The mono line above the name. Short — it is set in uppercase at a small
       size and stops being scannable past about forty characters. */
    role: "Full-stack Engineer",

    /* One sentence, not two. The old hero ran a pair of competing lines and
       neither landed; a single claim reads harder. */
    tagline: "I ship products end to end — schema to pixels, idea to uptime.",

    /* The scroll affordance under the fold. */
    scrollCue: "Scroll",
} as const;

/* ------------------------------------------------------------------
   Scrollytelling hero
   ------------------------------------------------------------------ */

export type HeroBeat = {
    /* Scroll range this beat owns, 0..1 through the sequence. */
    from: number;
    to: number;
    align: "center" | "left" | "right";
    title: string;
    body: string;
};

/* Three beats, not four.

   The last ~55 frames of the sequence carry a title card burned into the
   footage — it says the name and the tagline itself. A fourth overlay would
   sit on top of text that is already there, so the beats stop at 70% and the
   card plays out alone from 75% to the end.

   Alignment tracks where the subject actually is at that point in the footage:
   he fills the centre at the open, swings right of frame as he turns, then
   settles back to centre-left. Each beat takes the side he is not on. */
/* Deliberately NOT reusing `about.heading` or `about.body` below.

   The first draft of these beats lifted its copy straight from About, which
   sits one scroll further down the same page — so "I build the whole thing,
   not just the part that shows" appeared twice within a few seconds of each
   other, and "systems that stay boring" did too. The hero opens; About
   explains. They should not say the same sentence.

   These lead with the work instead, which leaves the card's identity reveal at
   the end of the footage as the payoff. */
export const heroBeats: HeroBeat[] = [
    {
        from: 0.0,
        to: 0.2,
        align: "center",
        title: "Full-stack engineer",
        body: "Currently building AI pipelines at Dataflow Group.",
    },
    {
        from: 0.25,
        to: 0.45,
        align: "left",
        title: "Serverless, at scale",
        body: "80% of processing automated. Turnaround cut 45%, routing accuracy up 35%.",
    },
    {
        from: 0.5,
        to: 0.7,
        align: "right",
        title: "Shipped, not demoed",
        body: "React Native crowdfunding at 90% payment success. Django latency down 60%.",
    },
];

/* The converted sequence in /public/hero-motion. `sm` is a 1280-wide set used on
   narrow viewports — 145 frames decoded at 1920x1080 is far more bitmap than a
   mid-range phone wants to hold. */
export const heroSequence = {
    count: 145,
    /* Matches the frames exactly, sampled across the sequence. The section
       background must be this value or the image's edges become visible. */
    background: "#010101",
    /* Encoded at the source's native 1920x1080 — no crop, no downscale. Anything
       smaller was being upscaled to fill the hero and read as soft. */
    aspect: 16 / 9,

    /* Where the frame sequence finishes. The footage's own ending — where he
       slides left and a title card fades in — is not in this cut, so the slide
       and the introduction are done here instead, as real text. */
    seqEnd: 0.78,
    /* How far the frame is pushed left to clear space for the introduction,
       as a fraction of the viewport width. He sits centred at the last frame,
       so this moves him to roughly the left third. */
    slideTo: -0.2,
    slideEnd: 0.94,
} as const;

/* The closing introduction. Rendered as live text in the same style as the
   beats above rather than baked into the footage, so it reflows, scales and can
   be read by a screen reader. */
export const heroIntro = {
    eyebrow: "Hi, I'm",
    name: "Ambud Lahiri",
    body: "I ship products end to end — schema to pixels, idea to uptime.",
    from: 0.82,
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

/* ------------------------------------------------------------------
   Projects
   ------------------------------------------------------------------ */

export type Project = {
    /* Shown as the card's index. Kept in the data rather than derived from the
       array position so reordering never silently renumbers a case study. */
    no: string;
    title: string;
    kind: string;
    detail: string;

    /* Plain strings, deliberately NOT TechId.

       The globe on /experience is driven by the `tech` list above — its point
       count comes from tech.length and every id needs an icon in Techglobe's
       PNG/SVG maps. These stacks include eight things that list has no entry
       for (Llama 3.1, Dart, OpenAI API, Firebase, Streamlit, SQLite, Daphne,
       Youtube API), and adding them would resize the globe and leave blank
       chips on it. A project's stack is a label on a card; it has no business
       being constrained by an unrelated component's icon set. */
    tech: string[];

    /* Optional — no dates were supplied for these, and inventing them on a
       portfolio is not a blank worth filling. Omitted rather than guessed. */
    period?: string;

    /* Card background, in /public/projects. These are WebP conversions of the
       supplied PNGs — the originals totalled 19.9 MB, which is not a thing to
       put behind four cards. Same pixels, 0.58 MB. */
    image: string;

    /* GitHub repository. The hover lens opens this in a new tab.

       Still optional: where it is missing the lens tracks the pointer as a
       hover affordance but the card is not a link, rather than pointing
       somewhere invented. All four current projects have one. */
    repo?: string;
};

/* The first card in the stack. It introduces the section rather than sitting
   above it as a separate heading block, so the whole section is one deck of
   cards and nothing competes with them for the viewport. */
export const projectsIntro = {
    eyebrow: "Selected work",
    title: "Projects",
    lines: [
        "A few things worth showing in detail.",
        "Scroll to step through them.",
    ],
} as const;

/* Names and stacks are reproduced exactly as supplied. The one-line `detail`
   for each is distilled from the fuller bullet points behind it — every number
   quoted here appears in that source material, none is new. `kind` is a short
   descriptive label, not a claim.

   The two seeded entries that used to sit here (Syntalix, Dataflow) were
   placeholders taken from `work` above; these replace them, which also clears
   the duplication between this section and the experience timeline. */
export const projects: Project[] = [
    {
        no: "01",
        title: "Murmur",
        repo: "https://github.com/Ambudlahiri144/Murmur",
        image: "/projects/murmur.webp",
        kind: "Social platform",
        detail:
            "A MERN social network with JWT-secured APIs, live Socket.IO messaging and notifications, and in-browser video processing that made uploads 75% faster.",
        tech: [
            "React.js",
            "Tailwind CSS",
            "Node.js",
            "Express.js",
            "Socket.IO",
            "MongoDB",
        ],
    },
    {
        no: "02",
        title: "Bail Reckoner",
        repo: "https://github.com/Ambudlahiri144/Sudo_bail",
        image: "/projects/bail.webp",
        kind: "Legal decision support",
        detail:
            "Automated case-law retrieval for legal professionals — a Next.js interface over FastAPI services, matching precedents in real time against a Llama 3.1 backed database.",
        tech: ["Next.js", "Django", "Python", "Llama 3.1", "Fast API"],
    },
    {
        no: "03",
        title: "BU-GPT",
        repo: "https://github.com/Ambudlahiri144/BU-GPT",
        image: "/projects/bu.webp",
        kind: "Mobile AI assistant",
        detail:
            "A Flutter assistant that answers questions against your own documents, with OpenAI-powered conversation behind Firebase auth, cutting manual document analysis by 90%.",
        tech: ["Flutter", "Dart", "OpenAI API", "Firebase"],
    },
    {
        no: "04",
        title: "Kine-sense",
        repo: "https://github.com/Ambudlahiri144/Kine-sense",
        image: "/projects/kine.webp",
        kind: "Video analytics",
        detail:
            "A video analytics platform that auto-categorises 95% of ingested YouTube content, then runs live engagement inference through Django Channels.",
        tech: [
            "Streamlit",
            "Django",
            "Python",
            "SQLite",
            "Daphne",
            "Youtube API",
        ],
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