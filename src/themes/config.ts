/* ------------------------------------------------------------------
   Which themes exist, and how a visitor's choice is remembered.

   Deliberately free of React and of any theme's code: src/proxy.ts imports
   this, and Proxy is bundled on its own, so pulling a component in here
   would drag the whole tree into it.
   ------------------------------------------------------------------ */

export const themes = ["dark", "light"] as const;

export type Theme = (typeof themes)[number];

/* Used when a visitor has no cookie and the browser sends no colour-scheme
   hint — see src/proxy.ts. */
export const defaultTheme: Theme = "dark";

/* Set by each theme's ThemeToggle, read by src/proxy.ts. */
export const themeCookie = "theme";

export function isTheme(value: unknown): value is Theme {
    return themes.includes(value as Theme);
}
