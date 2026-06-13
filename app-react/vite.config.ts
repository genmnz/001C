import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * COOP/COEP on both dev and preview so `crossOriginIsolated` is true in
 * development (SharedArrayBuffer + threaded WASM). Production is served by the
 * joeee server with the same headers.
 */
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: "es" },
  build: { target: "es2022", outDir: "dist" },
});
