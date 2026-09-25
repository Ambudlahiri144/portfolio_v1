/* ------------------------------------------------------------------
   The one place both themes meet.

   The files Next.js insists on having exactly one of — the root layout
   and each route's page.tsx in src/app — look their theme up here and
   render it. They hold no design of their own.

   `satisfies` is the contract: the light theme has to export everything
   the dark one does, with the same types, or this file stops compiling.
   Add a route by exporting it from BOTH themes' index.ts, then adding its
   page.tsx under src/app/[theme].
   ------------------------------------------------------------------ */

import type { Theme } from "./config";
import * as dark from "./dark";
import * as light from "./light";

export const registry = { dark, light } satisfies Record<Theme, typeof dark>;
