"use client";

import dynamic from "next/dynamic";

/* ==================================================================
   LOADER MOUNT

   A four-line client component that exists for one reason: `ssr: false`
   is not allowed on next/dynamic inside a Server Component, and the
   root layout is one.

   The door genuinely cannot be server-rendered. It decides whether to
   show at all by reading sessionStorage during its first render, and
   the server has no sessionStorage: rendered there it would either
   throw, or return a "never seen" answer that disagrees with the
   client's and mismatch on hydration. Rendering it only in the browser
   makes that question answerable at the one moment it can be answered.
   ================================================================== */

const KatanaLoader = dynamic(() => import("./KatanaLoader"), { ssr: false });

export default function LoaderMount() {
    return <KatanaLoader />;
}
