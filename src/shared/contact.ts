/* ------------------------------------------------------------------
   Contact data shared by BOTH themes and by the API routes.

   The route handlers in app/api are single files — Next.js allows one per
   path — so anything they validate against cannot live in a theme folder.
   Each theme's lib/site.ts re-exports from here rather than keeping its
   own copy, so the form a visitor sees and the check the server runs can
   never drift apart.

   Theme-specific wording (labels, blurbs, headings) stays in the theme's
   own site.ts. Only what the server reads belongs here.
   ------------------------------------------------------------------ */

/* Where everything the contact form sends is delivered.

   Read on the SERVER by /api/contact and /api/verify, unless
   CONTACT_TO_EMAIL overrides it. The same address is also shown publicly in
   the footer, by decision: it is already printed on every resume the Hire
   tab hands out, so hiding it here would protect nothing. */
export const contactEmail = "ambudlahiriofficial@outlook.com";

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

/* /api/verify looks the requested field up here to decide which resume to
   mail, so ids and paths must match what both themes render. */
export const hireFields: HireField[] = [
    { id: "sde", label: "SDE", resume: "/Ambud_Resume_SDE-1.pdf" },
    { id: "fullstack", label: "Full-Stack Development", resume: "/Resume_FullStack.pdf" },
    { id: "ai", label: "AI", resume: "/Ambud_Resume_AI.pdf" },
    { id: "android", label: "Android Development", resume: "/Resume_AppDev.pdf" },
    /* No resume by design — see the type above. This path asks what capacity
       they have in mind and is answered by hand. */
    { id: "others", label: "Others", resume: "" },
];
