/* ------------------------------------------------------------------
   SHARED — sends each visitor to their theme's tree.

   Both themes are complete, separate sites under src/themes, rendered at
   /dark/... and /light/... (see app/[theme]). This rewrites every page
   request to one of them. It is a rewrite, not a redirect: the address
   bar keeps showing /, /experience, /#about.

   The theme is chosen by, in order:
     1. the cookie ThemeToggle sets
     2. the browser's Sec-CH-Prefers-Color-Scheme hint (Chromium sends
        it from the second request on, once it has seen Accept-CH below)
     3. defaultTheme in src/themes/config.ts
   ------------------------------------------------------------------ */

import { NextResponse, type NextRequest } from "next/server";
import { defaultTheme, isTheme, themeCookie } from "@/themes/config";

export function proxy(request: NextRequest) {
  const fromCookie = request.cookies.get(themeCookie)?.value;
  const fromHint = request.headers.get("sec-ch-prefers-color-scheme");

  const theme = isTheme(fromCookie)
    ? fromCookie
    : isTheme(fromHint)
      ? fromHint
      : defaultTheme;

  const url = request.nextUrl.clone();
  url.pathname = `/${theme}${url.pathname === "/" ? "" : url.pathname}`;

  const response = NextResponse.rewrite(url);
  response.headers.set("Accept-CH", "Sec-CH-Prefers-Color-Scheme");
  /* The same URL now serves two different pages. Without this a shared
     cache would hand one visitor's theme to the next. */
  response.headers.set("Vary", "Cookie, Sec-CH-Prefers-Color-Scheme");
  return response;
}

export const config = {
  /* Pages only. Skips the API routes, Next's own assets, and anything with a
     file extension — every file in /public (footage, resumes, favicon) is
     shared by both themes and must never be rewritten into one of them. */
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
