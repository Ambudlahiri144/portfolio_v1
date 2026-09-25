/* The dark theme's public surface — everything the shared files in src/app
   render. src/themes/light/index.ts must export the same names; the registry
   type-checks that the two stay in step. */

export { metadata, viewport, htmlClassName, Body } from "./layout";
export { default as Home } from "./pages/Home";
export {
    default as Experience,
    metadata as experienceMetadata,
} from "./pages/Experience";
