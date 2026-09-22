import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party source, carried byte-for-byte as the
    // provenance baseline for the Sylva scene, plus the string modules
    // generated from it by scripts/sakura-scene.mjs. Linting a minified
    // r149 build produces thousands of warnings about code that must not
    // be touched. See src/shaders/sylva-living-world/LICENSE.
    "src/shaders/**",
  ]),
]);

export default eslintConfig;
