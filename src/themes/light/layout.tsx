/* ------------------------------------------------------------------
   The light theme's share of the root layout.

   Next.js allows exactly one root layout, and it lives at
   app/[theme]/layout.tsx — shared by both themes. That file owns only
   <html> and <body>; everything with a design decision in it is here:
   the fonts, the metadata, the browser chrome colour and what wraps the
   page (skip link, smooth scroll, the dock).

   The dark theme has its own copy at src/themes/dark/layout.tsx with
   the same exports. Keep the export names in step with it — the root
   layout reads both through src/themes/registry.ts.
   ------------------------------------------------------------------ */

import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  Geist,
  Bricolage_Grotesque,
  Dancing_Script,
  Instrument_Serif,
  Inter,
} from "next/font/google";
import { site } from "@light/lib/site";
import DockNav from "@light/components/Docknav";
import SmoothScroll from "@light/components/SmoothScroll";
import "./theme.css";
import { cn } from "@light/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


/* The site's display face. It started scoped to the hero, but it is now what
   --font-display resolves to, so the full weight range the rest of the site
   uses has to be loaded: 200 for the hero name, 300 for body and headings,
   400/500 for labels and card titles. Outfit has been removed — nothing
   referenced it any more and it was still being downloaded. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-bricolage",
  display: "swap",
});

/* One heading only — the contact form's. Scoped deliberately: a script face is
   an accent, and the moment it appears anywhere else it stops reading as one.
   Just the two weights that heading uses, nothing speculative. */
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-dancing",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

/* The video hero's headline face, and nothing else on the site.

   Scoped the same way Dancing_Script is: a serif inside a page set entirely in
   Bricolage is an accent, and it stops reading as one the moment it turns up
   somewhere a second time. 400 is the only upright weight Google publishes for
   this family, so there is nothing else to load.

   NOTE the variable name. The reference this came from called it
   --font-display, which already exists in theme.css and resolves to
   Bricolage — taking that name would have silently re-faced the entire site. */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument",
  display: "swap",
});

/* Body face for the video hero's subtext and its one button. Also scoped —
   everything below the hero stays on Bricolage. */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${site.name} — ${site.role}`,
  description: site.tagline,
};

export const viewport: Viewport = {
  themeColor: "#eff1ee",
};

/* The font variables belong on <html>, not <body>.

   --font-display and --font-mono are declared on html in theme.css as
   `var(--font-bricolage), …`. A custom property resolves its own var()
   references against the element it is declared on — so with the font
   classes on <body>, html had no --font-bricolage to read and --font-display
   computed to nothing at all. Every rule using it silently fell through to
   whatever <html> happened to be set to, which since the shadcn setup added
   `font-sans` has been Geist. The root layout puts this on <html>. */
export const htmlClassName = cn(
  geist.variable,
  bricolage.variable,
  plexMono.variable,
  dancingScript.variable,
  instrumentSerif.variable,
  inter.variable,
);

/* Everything inside <body>. */
export function Body({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="u-skip">
        Skip to content
      </a>
      {/* Wraps the routed content, not the dock — the dock is fixed and must
          never be inside a scroll-managed subtree. */}
      <SmoothScroll>{children}</SmoothScroll>
      {/* Lives in the layout so it persists across routes. */}
      <DockNav />
    </>
  );
}
