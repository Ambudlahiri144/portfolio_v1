/* ==================================================================
   THREE CONSOLE — two known, harmless messages, kept out of the console.

   Imported by every light-theme scene (the pop-up, the shelf). It uses
   three's own console hook, so only three's output passes through it,
   and every other log, warning and error is forwarded unchanged.

   - "Clock: This module has been deprecated": React Three Fiber builds a
     THREE.Clock for each canvas (still so in its latest release, 9.8.1).
     Remove this line once R3F moves to THREE.Timer.
   - ANGLE's X4122 note ("sum of … cannot be represented accurately in
     double precision"): the Direct3D shader compiler on Windows remarking
     on a float constant, surfaced by three as a program info log. It is a
     compiler note, not an error; the shader compiles and renders.
   ================================================================== */

import * as THREE from "three";

const DROP = ["Clock: This module has been deprecated", "warning X4122"];

if (!THREE.getConsoleFunction()) {
    THREE.setConsoleFunction((level, message, ...params) => {
        const text = [message, ...params].map(String).join(" ");
        if (level === "warn" && DROP.some((d) => text.includes(d))) return;
        const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
        out(message, ...params);
    });
}
