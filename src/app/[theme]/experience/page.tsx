/* SHARED — the /experience route for both themes. Next.js needs exactly one
   page.tsx per route, so this only picks the theme's own Experience page and
   renders it. The page itself lives in
   src/themes/<theme>/pages/Experience.tsx. */

import { isTheme } from "@/themes/config";
import { registry } from "@/themes/registry";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ theme: string }> };

export async function generateMetadata({ params }: Props) {
  const { theme } = await params;
  if (!isTheme(theme)) notFound();
  return registry[theme].experienceMetadata;
}

export default async function Page({ params }: Props) {
  const { theme } = await params;
  if (!isTheme(theme)) notFound();

  const { Experience } = registry[theme];
  return <Experience />;
}
