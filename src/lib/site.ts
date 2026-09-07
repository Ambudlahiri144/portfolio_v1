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
    tagline: "I ship products end to end, schema to pixels, idea to uptime.",
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

/* The hero's two worlds, in /public/scene/hero/{light,dark}, rendered by
   scripts/scene.mjs from the supplied clips. Light is a mountain path at
   sunrise; dark is a Tokyo alley in the rain. Both push forward and pass
   under a torii as the section ends. `sm` is a 960-wide set for phones. */
export const heroSequence = {
    count: 96,
    aspect: 16 / 9,

    /* Where the footage runs out. The remaining scroll is the push through
       the gate, which carries you into About rather than stopping dead on
       the last frame. */
    seqEnd: 0.78,
} as const;

/* The closing introduction. Rendered as live text in the same style as the
   beats above rather than baked into the footage, so it reflows, scales and can
   be read by a screen reader. */
export const heroIntro = {
    eyebrow: "Hi, I'm",
    name: "Ambud Lahiri",
    body: "I ship products end to end, schema to pixels, idea to uptime.",
    from: 0.82,
} as const;

/* The avatar, in /public/scene/avatar/{light,dark}, rendered by
   scripts/scene.mjs from the footage in /public/hero-motion.

   Keyed off its studio black and graded once per world, so he picks up the
   dojo's warm side light or the apartment's cool lamp rather than carrying a
   third lighting scheme into whichever room he is standing in. */
export const aboutSequence = {
    count: 72,
    /* The turn is finished before the section is centred, so the figure is
       facing the reader for the whole time the copy beside him is readable.
       The remaining scroll holds on that last frame. */
    seqEnd: 0.62,
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
    /* The frame the reduced-motion branch holds on: the end of the turn,
       where he is facing the reader. Per world, like the sequence itself. */
    photo: (theme: "light" | "dark") => `/scene/avatar/${theme}/frame-072.webp`,
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
        period: "Aug 2025 - April 2026",
        title: "Full-Stack Developer Intern",
        org: "Syntalix",
        detail:
            "Built React Native crowdfunding platform with 90% payment success. Cut Django latency 60% and led React/Tailwind UX redesign.",
        tech: ["react", "expo", "django", "python", "tailwind", "javascript"],
    },
    {
        period: "May 2026 - Present",
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
    /* Which pigment this project's leaf is cut in. One per project, drawn
       from the Edo set in globals.css, so the four read as four blocks from
       the same workshop rather than four unrelated pictures. */
    pigment: "ai" | "rokusho" | "gunjo" | "odo";

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
        image: "/scene/projects/murmur.webp",
        pigment: "ai",
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
        image: "/scene/projects/bail.webp",
        pigment: "rokusho",
        kind: "Legal decision support",
        detail:
            "Automated case-law retrieval for legal professionals. A Next.js interface over FastAPI services, matching precedents in real time against a Llama 3.1 backed database.",
        tech: ["Next.js", "Django", "Python", "Llama 3.1", "Fast API"],
    },
    {
        no: "03",
        title: "BU-GPT",
        repo: "https://github.com/Ambudlahiri144/BU-GPT",
        image: "/scene/projects/bu.webp",
        pigment: "gunjo",
        kind: "Mobile AI assistant",
        detail:
            "A Flutter assistant that answers questions against your own documents, with OpenAI-powered conversation behind Firebase auth, cutting manual document analysis by 90%.",
        tech: ["Flutter", "Dart", "OpenAI API", "Firebase"],
    },
    {
        no: "04",
        title: "Kine-sense",
        repo: "https://github.com/Ambudlahiri144/Kine-sense",
        image: "/scene/projects/kine.webp",
        pigment: "odo",
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

/* ------------------------------------------------------------------
   Contact
   ------------------------------------------------------------------ */

/* The contact section's two worlds, in /public/scene/contact/{light,dark}.
   Light climbs the last steps to a summit shrine in the afternoon; dark
   approaches an old shrine wedged between towers in the rain. Both arrive
   and come to rest facing it. */
export const contactSequence = {
    count: 72,

    /* These frames are lit right to the edge, so no ground colour can hide
       their rectangle; the section's .veil fades their borders into var(--bg)
       instead, in both themes. */
    aspect: 16 / 9,

    /* Where the frames run out. The remaining scroll holds on the settled cup,
       leaving room for the section's closing content. */
    seqEnd: 0.82,
} as const;

export type ContactBeat = {
    /* Scroll range this beat owns, 0..1 through the sequence. */
    from: number;
    to: number;
    align: "center" | "left" | "right";
    title: string;
    /* Optional. These three beats are single lines by design — a subtitle under
       "Still here?" would answer the question the line is asking. */
    body?: string;
};

/* Three lines, timed to the grinding.

   The footage is an inkstick worked in circles on a wet stone until the well
   is full, so the beats track how much ink there is: a question while the
   stone is still bare, the answer once it has pooled, and the invitation as
   it thickens. "Take a sip" lived here while the footage was an espresso and
   left with it.

   Spaced with a clear gap between each, so only ever one line is on screen
   and none is mid-fade while it is alone. The last clears by 0.78, leaving a
   stretch of full inkwell before the form arrives on it. */
export const contactBeats: ContactBeat[] = [
    { from: 0.05, to: 0.28, align: "center", title: "Still here?" },
    { from: 0.33, to: 0.54, align: "center", title: "The ink is ready" },
    { from: 0.59, to: 0.78, align: "center", title: "Let's connect" },
];

/* The form that closes the page. `from` sits past seqEnd (0.82), so it fades up
   over the held final frame rather than competing with the footage. It holds to
   the end of the scroll — this is the last thing on the page, and something the
   visitor is meant to actually use. */
/* Which field a visitor is hiring for. The first four each map to their own
   resume; "others" deliberately has none — that path asks what capacity they
   have in mind and is answered by hand with whichever resume actually fits. */
export type HireField = {
    id: string;
    label: string;
    /**
     * Path to the PDF in /public.
     *
     * Empty means "not supplied yet" — the UI renders a disabled control saying
     * so rather than a live link to a 404. "others" is the only one that stays
     * empty on purpose.
     */
    resume: string;
};

export const hireFields: HireField[] = [
    { id: "sde", label: "SDE", resume: "/Ambud_Resume_SDE-1.pdf" },
    { id: "fullstack", label: "Full-Stack Development", resume: "/Resume_FullStack.pdf" },
    { id: "ai", label: "AI", resume: "/Ambud_Resume_AI.pdf" },
    { id: "android", label: "Android Development", resume: "/Resume_AppDev.pdf" },
    /* No resume by design — see the type above. This path asks what capacity
       they have in mind and is answered by hand. */
    { id: "others", label: "Others", resume: "" },
];

/* The form that closes the page. `from` sits past seqEnd (0.82), so it fades up
   over the held final frame rather than competing with the footage. It holds to
   the end of the scroll — this is the last thing on the page, and something the
   visitor is meant to actually use. */
export const contactForm = {
    from: 0.86,
    heading: "Drop a message",

    /* Where everything this form sends is delivered.
     *
     * Read on the SERVER by /api/contact and /api/verify. The same address is
     * also shown publicly in the footer, by decision: it is already printed on
     * every resume the Hire tab hands out, so hiding it here would protect
     * nothing. The footer reads `footer.email` below rather than this field, so
     * the two can diverge if a separate public address is ever wanted. */
    email: "ambudlahiriofficial@outlook.com",

    submit: "Send message",

    /* Three reasons someone might be down here, in rough order of how many
       visitors each one covers. */
    tabs: [
        {
            id: "feedback",
            label: "Feedback",
            title: "How did the site land?",
            blurb:
                "Anything that felt good, anything that broke, anything you would have done differently. Blunt is fine.",
            messageLabel: "Your comment",
        },
        {
            id: "connect",
            label: "Connect",
            title: "Start a conversation",
            blurb:
                "A proposal, a project, a question — or something entirely unrelated. All of it is welcome.",
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
            /* Deliberately the same file as the SDE CV — freelance work here is
               the same engineering, sold differently, so a separate document
               would only be the same content under another filename. */
            resume: "/Ambud_Resume_SDE-1.pdf",
            resumeLabel: "Freelance CV",
        },
        employee: {
            label: "As an employee",
            blurb:
                "Tell me which side of the stack the role sits on and I will send you the CV written for it.",
            question: "Which field are you hiring for?",
            /* Only the resume downloads sit behind the code. The "Others" path
               has no file to gate, so it stays a plain message. */
            verifyBlurb:
                "The CV goes to a verified address, so I know who I am talking to. Enter your email and I will send a six-digit code.",
            othersLabel: "In what capacity are you hiring?",
            othersNote:
                "Drop a message with the job requirements in detail and I will be in touch shortly with the resume that fits.",
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
   Footer
   ------------------------------------------------------------------ */

export type SocialLink = {
    id: "github" | "linkedin" | "instagram" | "leetcode";
    label: string;
    /**
     * Empty means "not supplied yet".
     *
     * The footer still LISTS an empty entry, dimmed and not clickable, rather
     * than hiding it: the row is a statement about where to find me, and a
     * missing URL is a temporary gap rather than a reason to pretend the
     * account does not exist. Fill the href in and it becomes a live link with
     * no other change.
     */
    href: string;
};

export const social: SocialLink[] = [
    { id: "github", label: "GitHub", href: "https://github.com/Ambudlahiri144" },
    {
        id: "linkedin",
        label: "LinkedIn",
        href: "https://www.linkedin.com/in/ambud-lahiri/",
    },
    {
        id: "instagram",
        label: "Instagram",
        href: "https://www.instagram.com/ambudlahiri_004/",
    },
    {
        id: "leetcode",
        label: "LeetCode",
        href: "https://leetcode.com/u/Ambudlahiri144/",
    },
];

export const footer = {
    /* Public by decision. See the note on contactForm.email above. Reached
       from the footer as an "Email" row beside the social links rather than
       printed in full, so the column reads as one list of ways to get hold of
       me instead of a link list plus a loose address. */
    email: "ambudlahiriofficial@outlook.com",
    backToTop: "Back to top",

    /* Routes the footer lists beyond the dock's four. The dock leaves
       /experience out on purpose, since its blob only tracks the one-page
       sections; the footer has no such constraint. */
    extraLinks: [{ id: "experience", label: "Experience", href: "/experience" }],

    /* Plain nouns, not the small uppercase wide-tracking labels this codebase
       otherwise avoids. Three short columns need naming to be scannable; they
       do not need decorating. */
    columns: {
        explore: "Explore",
        work: "Work",
        connect: "Connect",
    },
} as const;

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