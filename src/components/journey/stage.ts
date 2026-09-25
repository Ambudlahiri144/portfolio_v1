"use client";

import { createContext } from "react";

/* ==================================================================
   THE STAGE — what Journey tells the section it carries

   Projects is pinned inside Journey's track, on top of the frame the
   camera comes to rest on. Pinned, its own position says nothing about
   when it should appear — it is sitting at the top of the window long
   before the camera gets there — so the camera has to say it instead.

     shown   the camera has settled on the last frame: fade in.
     boot    the camera is into the settle: start building anything
             expensive now, behind the scenes, so it is ready to fade in.
             Latched — once built it stays built.
     covered the wipe into Contact has blacked it out: go inert, so
             cards nobody can see cannot be clicked or tabbed to.

   `null` means there is no stage: the section is an ordinary part of the
   page (reduced motion renders it that way) and decides for itself.
   ================================================================== */
export type Stage = { shown: boolean; boot: boolean; covered: boolean };

export const StageContext = createContext<Stage | null>(null);
