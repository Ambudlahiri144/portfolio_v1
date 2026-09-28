"use client";

import { createContext, useContext } from "react";

/* Whether the spread a component sits on is the one at rest on the page.
   Book.tsx provides it per spread. Outside the scrolled book (BookStatic,
   reduced motion) there is no page coming to rest, so it is `null` and
   things that animate on arrival simply appear finished. */
export const SpreadActiveContext = createContext<boolean | null>(null);

export const useSpreadActive = () => useContext(SpreadActiveContext);
