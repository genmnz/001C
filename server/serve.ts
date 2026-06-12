/**
 * joeee tiny server — static files + the two headers that make everything else
 * possible. Cross-origin isolation (COOP: same-origin, COEP: require-corp) is
 * REQUIRED for SharedArrayBuffer and threaded WASM; without it, `crossOriginIsolated`
 * is false and the SAB-backed EventMatrix silently falls back to a per-worker
 * copy. This is the #1 thing the de-risking doc says to wire up on day one.
 *
 * Run:  JOEEE_ROOT=app-web/dist bun run server/serve.ts
 * Prod: put these same headers on your CDN/host (Netlify _headers, nginx
 *       add_header ... always, etc.). Self-host fonts/assets, or send them with
 *       Cross-Origin-Resource-Policy, or COEP: require-corp will block them.
 */
const ROOT = process.env.JOEEE_ROOT ?? "app-web/dist";
const PORT = Number(process.env.PORT ?? 5180);

const ISOLATION_HEADERS: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".wgsl": "text/plain; charset=utf-8",
  ".fcs": "application/octet-stream",
  ".svg": "image/svg+xml",
};

function contentType(path: string): string {
  const dot = path.lastIndexOf(".");
  return CONTENT_TYPES[path.slice(dot)] ?? "application/octet-stream";
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    // Prevent path traversal above ROOT.
    if (pathname.includes("..")) {
      return new Response("Bad request", { status: 400, headers: ISOLATION_HEADERS });
    }

    let file = Bun.file(ROOT + pathname);
    // SPA fallback: unknown non-asset routes serve index.html.
    if (!(await file.exists())) {
      if (!pathname.includes(".")) file = Bun.file(ROOT + "/index.html");
      if (!(await file.exists())) {
        return new Response("Not found", { status: 404, headers: ISOLATION_HEADERS });
      }
    }

    return new Response(file, {
      headers: { ...ISOLATION_HEADERS, "Content-Type": contentType(pathname) },
    });
  },
});

console.log(
  `joeee server: http://localhost:${server.port}  root="${ROOT}"  (cross-origin isolated)`,
);
