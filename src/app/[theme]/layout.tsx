/* ------------------------------------------------------------------
   SHARED — the root layout for both themes.

   Next.js allows exactly one root layout, so it cannot live in a theme
   folder. It owns <html> and <body> and nothing else: the fonts, the
   metadata, the chrome and every other design decision come from the
   theme's own layout.tsx through src/themes/registry.ts.

   How a visitor lands in a theme: src/proxy.ts reads their choice and
   rewrites `/` to `/dark` or `/light` internally — the address bar never
   shows it. Both are rendered statically at build time, so picking a theme
   on the server costs nothing per request.

   Rendering data-theme here, on the server, is also what replaced the old
   blocking inline script. The theme is already right in the HTML, so there
   is nothing to correct before first paint.
   ------------------------------------------------------------------ */

import { notFound } from "next/navigation";
import { isTheme, themes } from "@/themes/config";
import { registry } from "@/themes/registry";
import "../globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{ theme: string }>;
};

/* Anything outside `themes` is a 404, not a render with a missing theme. */
export const dynamicParams = false;

export function generateStaticParams() {
  return themes.map((theme) => ({ theme }));
}

async function resolve(params: Props["params"]) {
  const { theme } = await params;
  if (!isTheme(theme)) notFound();
  return registry[theme];
}

export async function generateMetadata({ params }: Omit<Props, "children">) {
  return (await resolve(params)).metadata;
}

export async function generateViewport({ params }: Omit<Props, "children">) {
  return (await resolve(params)).viewport;
}

export default async function RootLayout({ children, params }: Props) {
  const { theme } = await params;
  const t = await resolve(params);

  return (
    <html lang="en" data-theme={theme} className={t.htmlClassName}>
      <body>
        <t.Body>{children}</t.Body>
      </body>
    </html>
  );
}
