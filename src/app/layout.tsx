import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  Geist,
  Bricolage_Grotesque,
  Shippori_Mincho,
} from "next/font/google";
import { site } from "@/lib/site";
import DockNav from "@/components/Docknav";
import SmoothScroll from "@/components/SmoothScroll";
/* The door. See LoaderMount for why it cannot be imported directly here. */
import LoaderMount from "@/components/loader/LoaderMount";
import "./globals.css";
import { cn } from "@/lib/utils";

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

/* Display serif, for a few section-level moments only: the contact form's
   heading, the About and Projects titles, the Experience h1. A face from the
   Mincho tradition with proper Latin glyphs, so it reads as Japanese
   typographic heritage rather than as a brush-font costume. Two weights;
   nothing speculative. Bricolage stays the face of everything else. */
const shippori = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-shippori",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${site.name} — ${site.role}`,
  description: site.tagline,
};

export const viewport: Viewport = {
  themeColor: [
    /* Must track --bg in globals.css, both themes: this is the colour the
       browser paints its own chrome with before the page has rendered. */
    { media: "(prefers-color-scheme: light)", color: "#f1eadb" },
    { media: "(prefers-color-scheme: dark)", color: "#14100e" },
  ],
};

/* Runs before first paint — no white flash on reload. */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
  /* Scroll reveals hide their content until observed. This class is the
     gate for that, so if the script fails nothing is stuck invisible. */
  document.documentElement.classList.add("js");
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* No data-scroll-behavior. That attribute only does anything when CSS
     `scroll-behavior: smooth` is set globally — it tells Next to temporarily
     override it during route transitions. Lenis handles smoothing now and the
     CSS rule is gone, so there is nothing left for it to override. */
  return (
    /* The font variables belong on <html>, not <body>.

       --font-display and --font-mono are declared on :root in globals.css as
       `var(--font-bricolage), …`. A custom property resolves its own var()
       references against the element it is declared on — so with the font
       classes on <body>, :root had no --font-bricolage to read and
       --font-display computed to nothing at all. Every rule using it silently
       fell through to whatever <html> happened to be set to, which since the
       shadcn setup added `font-sans` has been Geist. */
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        geist.variable,
        bricolage.variable,
        plexMono.variable,
        shippori.variable,
      )}
    >
      <head>
        {/* A raw, blocking, inline script — on purpose. Please leave it.

            React logs "Encountered a script tag while rendering React
            component" for this in development. That warning is EXPECTED here
            and has been investigated twice; do not try to fix it again:

            - It is dev-only. The string exists in react-dom-client.development
              .js and appears zero times in the production build, so no visitor
              ever sees it.
            - There is no way to silence it while keeping the script. React's
              client renderer switches on the tag name and the sole bypass,
              isScriptDataBlock(), is true only for NON-executable `type`s —
              it explicitly excludes module, importmap and every JavaScript
              MIME type. `src` does not help either.
            - next/script with beforeInteractive does not silence it, and puts
              the script later in the document (inside <body>), which is worse
              for the thing this exists to prevent.

            It has to run before first paint or every reload flashes the wrong
            theme, and it has to be inline or it costs a round trip to do it.

            The only real alternative is storing the theme in a cookie and
            rendering data-theme on the server — which removes the script, but
            cookies() opts the entire app out of static generation. That
            trade was considered and declined. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="u-skip">
          Skip to content
        </a>
        {/* Wraps the routed content, not the dock — the dock is fixed and must
            never be inside a scroll-managed subtree. */}
        <SmoothScroll>{children}</SmoothScroll>

        {/* Over everything, including the dock. It removes itself. */}
        <LoaderMount />
        {/* Lives in the layout so it persists across routes. */}
        <DockNav />
      </body>
    </html>
  );
}