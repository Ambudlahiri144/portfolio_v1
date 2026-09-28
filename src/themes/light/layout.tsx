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
  Cormorant_Garamond,
  Geist,
  IBM_Plex_Mono,
  Literata,
} from "next/font/google";
import { site } from "@light/lib/site";
import DockNav from "@light/components/Docknav";
import SmoothScroll from "@light/components/SmoothScroll";
import InkDefs from "@light/components/InkDefs";
import "./theme.css";
import { cn } from "@light/lib/utils";

/* Interface chrome: the dock, form labels, buttons. Also what shadcn's
   `font-sans` resolves to. */
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

/* Titles. 500 for headings, 600 for the name on the cover, and the italic
   for the occasional emphasised word — a book sets emphasis in italic of
   the same face, not in a second family. */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

/* The page's reading face. Variable, so every weight in between costs
   nothing extra; the italic is loaded for titles of works and emphasis. */
const literata = Literata({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-literata",
  display: "swap",
});

/* Tech stacks and other labels that are data rather than prose. */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${site.name}, ${site.role}`,
  description: site.tagline,
};

/* The tablecloth, so the browser chrome continues the table. */
export const viewport: Viewport = {
  themeColor: "#cdb69e",
};

/* The font variables belong on <html>, not <body>: theme.css declares
   --font-serif and friends on html as `var(--font-cormorant), …`, and a
   custom property resolves its var() references on the element it is
   declared on. The root layout puts this on <html>. */
export const htmlClassName = cn(
  geist.variable,
  cormorant.variable,
  literata.variable,
  plexMono.variable,
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
      {/* The ink-bloom buttons' shared filter and entry-point tracking. */}
      <InkDefs />
    </>
  );
}
