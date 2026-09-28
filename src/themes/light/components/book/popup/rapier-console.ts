/* ==================================================================
   RAPIER CONSOLE — one known, harmless warning, kept out of the console.

   Imported by Letterpress, the only user of the physics engine.

   @dimforge/rapier3d-compat 0.19.2 (what @react-three/rapier 2.2.0 pins)
   hands its inlined wasm to wasm-bindgen's init as a bare argument, and
   wasm-bindgen warns "using deprecated parameters for the initialization
   function" on every page that starts the engine. It is the library
   talking to itself; nothing we pass can change it. Rapier's own console
   has no hook like three's, so console.warn is wrapped, and every other
   warning is forwarded unchanged. Remove this file once Rapier's compat
   build calls init with an object.
   ================================================================== */

const DROP = "using deprecated parameters for the initialization function";

const w = globalThis as { __rapierConsole?: true };
if (typeof console !== "undefined" && !w.__rapierConsole) {
    w.__rapierConsole = true;
    const warn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].startsWith(DROP)) return;
        warn(...args);
    };
}
