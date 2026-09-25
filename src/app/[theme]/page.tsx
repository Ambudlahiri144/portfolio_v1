/* SHARED — the home route for both themes. Next.js needs exactly one
   page.tsx per route, so this only picks the theme's own Home and renders
   it. The page itself lives in src/themes/<theme>/pages/Home.tsx. */

import { isTheme } from "@/themes/config";
import { registry } from "@/themes/registry";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ theme: string }>;
}) {
  const { theme } = await params;
  if (!isTheme(theme)) notFound();

  const { Home } = registry[theme];
  return <Home />;
}
