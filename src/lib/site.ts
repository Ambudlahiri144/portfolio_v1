/* ------------------------------------------------------------------
   Everything you personalise lives here.
   ------------------------------------------------------------------ */

export const site = {
    name: "Ambud Lahiri",
    greeting: "Hi, I'm",
    /* Two lines, revealed in order. Keep them roughly even in length —
       the reveal reads best when the block stays visually balanced. */
    lines: [
        "I ship products end to end — schema to pixels, idea to uptime.",
        "Full-stack engineer who thinks like a product designer.",
    ],
} as const;

export type NavItem = {
    id: string;
    label: string;
    href: string;
    icon: "home" | "about" | "projects" | "contact";
};

export const nav: NavItem[] = [
    { id: "home", label: "Home", href: "#top", icon: "home" },
    { id: "about", label: "About", href: "#about", icon: "about" },
    { id: "projects", label: "Projects", href: "#projects", icon: "projects" },
    { id: "contact", label: "Contact", href: "#contact", icon: "contact" },
];