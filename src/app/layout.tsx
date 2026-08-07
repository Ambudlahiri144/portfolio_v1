import type { Metadata, Viewport } from "next";
import { Outfit, IBM_Plex_Mono } from "next/font/google";
import { site } from "@/lib/site";
import DockNav from "@/components/Docknav";
import "./globals.css";

/* Outfit is a geometric sans with near-circular bowls and a very clean
   Light weight — it holds up at the display size the hero runs at. */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-outfit",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${site.name} — Full-stack Engineer`,
  description: site.lines[0],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff1ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0d" },
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
  /* data-scroll-behavior tells Next to suppress smooth scrolling during
     route transitions, so navigating to /experience jumps to the top
     instantly instead of gliding there. In-page anchors stay smooth. */
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${outfit.variable} ${plexMono.variable}`}>
        <a href="#main" className="u-skip">
          Skip to content
        </a>
        {children}
        {/* Lives in the layout so it persists across routes. */}
        <DockNav />
      </body>
    </html>
  );
}