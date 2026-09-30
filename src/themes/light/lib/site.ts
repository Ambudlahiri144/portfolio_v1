/* ------------------------------------------------------------------
   Everything you personalise in the LIGHT theme lives here.

   The light theme is a book read by scrolling: the cover, four open
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

export type BookClip = "open" | "turnA" | "turnB" | "tilt" | "reveal";

export type SpreadId =
    | "cover"
    | "about"
    | "projects-intro"
    | "popup"
    | "contact"
    | "closed"
    | "end";

export type BookSegment =
    | { kind: "hold"; spread: SpreadId; vh: number; anchor?: string }
    | { kind: "motion"; clip: BookClip; reverse?: boolean; vh: number };

/* ------------------------------------------------------------------
   THE CAT

   A seal-point Siamese who lives in the room with the book. She walks
   past along the right-hand edge while you read About, peeks over the
   top-right corner at Contact while you write, and at the very end the
   camera comes down to the table where she lies beside the closed book,
   to be petted (components/book/cat, components/book/end).

   Her footage is generated, then processed by scripts/book-cat.mjs into
   public/book/cat/; `enabled` stays off until it has been, and the book
   ends as it did before.
   ------------------------------------------------------------------ */

export const cat = {
    enabled: true,
    /* The pages she appears on, and how long after the pen has finished
       writing that page (seconds). */
    walk: { spread: "about" as SpreadId, delay: 1.2 },
    peek: { spread: "contact" as SpreadId, delay: 4 },
    /* The first time a page is reached on a visit she always appears;
       after that, with this chance, so it stays a surprise. */
    again: 1 / 3,
    /* Left alone at the end, she does something now and then (seconds). */
    ambient: [12, 20] as [number, number],
} as const;

/* The two page turns alternate. Blank pages make every turn look alike,
   and alternating two different takes is what keeps that from showing. */
export const bookTimeline: BookSegment[] = [
    { kind: "hold", spread: "cover", vh: 60, anchor: "top" },
    { kind: "motion", clip: "open", vh: 130 },
    { kind: "hold", spread: "about", vh: 150, anchor: "about" },
    /* Work and education are not in the book: /experience (the full
       record, linked from About and the colophon) has all of it. */
    { kind: "motion", clip: "turnB", vh: 90 },
    { kind: "hold", spread: "projects-intro", vh: 70 },
    /* The camera comes down to the front of the book, where the projects
       stand up off the page as a pop-up. The same clip reversed takes it
       back overhead. */
    { kind: "motion", clip: "tilt", vh: 120 },
    { kind: "hold", spread: "popup", vh: 460, anchor: "projects" },
    { kind: "motion", clip: "tilt", reverse: true, vh: 110 },
    { kind: "motion", clip: "turnA", vh: 100 },
    { kind: "hold", spread: "contact", vh: 190, anchor: "contact" },
    /* Closing the book is the opening played backwards. */
    { kind: "motion", clip: "open", reverse: true, vh: 120 },
    /* The pen writes "Thank you for reading." beside the closed book. With
       the cat, the camera then comes down to the table where she lies. */
    ...(cat.enabled
        ? ([
              { kind: "hold", spread: "closed", vh: 60 },
              { kind: "motion", clip: "reveal", vh: 140 },
              { kind: "hold", spread: "end", vh: 170, anchor: "end" },
          ] as BookSegment[])
        : ([{ kind: "hold", spread: "closed", vh: 80 }] as BookSegment[])),
];

/* The fountain pen that writes each page's text as its spread comes to
   rest (components/book/pen). Speeds are in em of the text's own size per
   second, so a large heading is written as slowly as a hand would write
   it and body text quickly; a whole spread, the pen's moves between lines
   included, is never allowed longer than `maxSeconds`, so a long page
   speeds up rather than keeping a reader waiting. */
export const pen = {
    speed: { line: 8, heading: 12, body: 40 },
    maxSeconds: 6.5,
    /* A fountain pen with its cap posted is about 14 cm. */
    lengthCm: 14,
} as const;

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

    /* A print tipped onto the left page that can be peeled back by its
       corner to show the note written underneath. Leave `src` empty and
       the page shows the opening line alone. The portrait is a pencil
       drawing; scripts/book-props.mjs makes portrait.webp from
       public/book/props/light.png. */
    photo: {
        src: "/book/props/portrait.webp",
        /* Its contour lines, drawn first when About comes to rest. */
        lines: "/book/props/portrait-lines.webp",
        alt: "Pencil portrait of Ambud Lahiri",
        /* DRAFT: replace with your own words. */
        note: "If you peeled this back, we will get along. Say hello on the last page.",
    },
} as const;

export type NavItem = {
    id: string;
    label: string;
    href: string;
    icon: "home" | "about" | "projects" | "contact";
};

/* Root-relative so the dock still works from /experience. */
export const nav: NavItem[] = [
    { id: "home", label: "Cover", href: "/#top", icon: "home" },
    { id: "about", label: "About", href: "/#about", icon: "about" },
    { id: "projects", label: "Projects", href: "/#projects", icon: "projects" },
    { id: "contact", label: "Contact", href: "/#contact", icon: "contact" },
];

/* ------------------------------------------------------------------
   Work, education and stacks, shown on /experience's shelf.
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
    /* The right page of the intro spread, before the camera comes down. */
    invite: "Four things I built, and what they are made of. Lean in.",
    /* The pop-up's hint, shown once the cards are up. */
    hint: "Pick a card to take it out of the book.",
    close: "Put it back",
    stackLabel: "Built with",
} as const;

/* ------------------------------------------------------------------
   Contact
   ------------------------------------------------------------------ */

/* Which field a visitor is hiring for. Lives in src/shared because
   /api/verify validates against it. */
export { hireFields, type HireField } from "@/shared/contact";

export const contactSpread = {
    heading: "Write to me",
    body: "Feedback on the book, a project, a role, or something else entirely. Choose some paper; every message is read, and most are answered within a day.",
    direct: "Or write directly to",
} as const;

/* The contact spread is a writing desk. The right page holds three kinds
   of stationery; the one chosen lies on the left page to be written on,
   and a postage stamp dragged onto it sends it. Each paper asks what its
   kind of message needs, in that paper's own conventions. */
export const stationery = {
    /* Where everything sent is delivered. Defined in src/shared so the API
       routes read the same value. */
    email: contactEmail,

    chooser: "Choose your paper",
    /* Under a paper's empty place on the right page while it is out. */
    onDesk: "On the desk",

    papers: [
        { id: "feedback", name: "Postcard", purpose: "Feedback" },
        { id: "connect", name: "Letter", purpose: "Connect" },
        { id: "hire", name: "Engagement card", purpose: "Hire me" },
    ],

    stamp: {
        /* Printed across the top of the stamp, and its value. */
        legend: "The Book",
        value: "1",
        hint: "Drag the stamp onto the box to send, or",
        send: "Send",
        sending: "Posting",
        target: "Stamp",
    },

    /* Pencilled in the margin by a field that stops a send. */
    errors: {
        name: "Who is writing?",
        email: "Where do I reply?",
        emailInvalid: "That address looks off.",
        message: "Nothing written yet.",
        capacity: "In what capacity?",
        choice: "Circle one first.",
    },

    postcard: {
        heading: "Post card",
        message: "How did the book read?",
        prompt: "Anything that felt good, anything that broke. Blunt is fine.",
        from: "From",
        replyTo: "Reply to",
        /* The picture side, seen as the card turns over on its way. */
        picture: "Greetings from the Book",
    },

    letter: {
        salutation: "Dear Ambud,",
        re: "Re:",
        message: "Your letter",
        signOff: "Yours,",
        signature: "Your name",
        replyTo: "Reply to",
    },

    engagement: {
        heading: "Engagement",
        engageAs: "I would like to engage you as",
        options: { freelance: "a freelancer", employee: "an employee" },
        forRole: "for the role of",
        freelance: {
            blurb: "Project work, a fixed scope, or an extra pair of hands for a sprint.",
            /* The same file as the SDE CV: freelance work is the same
               engineering, sold differently. */
            resume: "/Ambud_Resume_SDE-1.pdf",
            resumeLabel: "Freelance CV",
            brief: "Project brief",
        },
        others: {
            capacity: "In what capacity?",
            requirements: "Job requirements",
        },
        turnOver: "Turn over to verify",
        turnBack: "Turn back",
        back: {
            heading: "Verification",
            blurb: "The CV goes to a verified address, so I know who I am talking to. I will send a six-digit code.",
            email: "Your work email",
            request: "Send me a code",
            requesting: "Sending",
            code: "Six-digit code",
            confirm: "Verify",
            confirming: "Checking",
            resend: "Send another",
            verified: "Verified",
            cvFor: "CV",
        },
    },

    /* After a send, inked onto the empty page. */
    sent: {
        title: "Sent. Thank you.",
        body: "It is on its way. I read every one, and most get a reply within a day.",
        again: "Write another",
        received: "Received",
    },

    fields: {
        name: "Name",
        email: "Email",
    },
} as const;

export type PaperId = (typeof stationery.papers)[number]["id"];

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
    /* Public by decision: it is already printed on every CV the engagement
       card hands out. */
    email: contactEmail,
    backToTop: "Back to the cover",
    fullRecord: { label: "The full record", href: "/experience" },
    colophon: "Set in Cormorant Garamond and Literata. Built with Next.js.",
    /* The name on the bookplate inside the back cover. */
    bookplate: site.name,
} as const;

/* ------------------------------------------------------------------
   The last scene: the cat on the table, and the way back into the book
   set in maple type in front of her (components/book/end).
   ------------------------------------------------------------------ */

export type EndBlock = { label: string } & ({ anchor: string } | { href: string });

export const endScene = {
    /* Left to right on the table. `anchor` is a spread's anchor in the
       book (bookTimeline); `href` leaves the book. */
    blocks: [
        { label: "About", anchor: "about" },
        { label: "Projects", anchor: "projects" },
        { label: "Contact", anchor: "contact" },
        { label: "The full record", href: "/experience" },
        { label: "Back to the cover", anchor: "top" },
    ] as EndBlock[],
    /* What each part of her says to a screen reader, as a button. */
    pet: {
        head: "Pet the cat's head",
        chin: "Scratch the cat's chin",
        ear: "Touch the cat's ear",
        back: "Stroke the cat's back",
        tail: "Touch the cat's tail",
        paws: "Touch the cat's paws",
        neck: "Scratch the cat's neck",
        face: "Boop the cat's nose",
    },
    petHint: "She likes being petted.",
    stillAlt: "A seal-point Siamese cat lying curled on the table beside the closed book, head up, watching you.",
} as const;
