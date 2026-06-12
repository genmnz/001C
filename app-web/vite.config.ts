import { defineConfig } from "vite";

/**
 * Dev/build config for the reference app. The two isolation headers are set on
 * BOTH the dev server and the preview server so `crossOriginIsolated` is true in
 * development (SharedArrayBuffer + threaded WASM work) — not just in production
 * behind the joeee server. There is a known gap where Vite's HMR socket can be
 * blocked by COEP; if you hit it, add `vite-plugin-cross-origin-isolation`.
 *
 * For production, `vite build` emits app-web/dist, which the joeee server
 * (server/serve.ts) serves with the same headers.
 */
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: "es" },
  build: {
    target: "es2022",
    outDir: "dist",
  },
  // .wasm and .wgsl are served same-origin so COEP allows them.
  assetsInclude: ["**/*.wgsl"],
});
