/**
 * Worker entry: hosts the joeee engine off the main thread. Vite bundles this as
 * a separate module worker because main.tsx references it via
 * `new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" })`.
 *
 * It is deliberately thin — the actual RPC host lives in @joeee/engine-controller
 * (the UI-agnostic boundary). Calling installEngineWorker() (rather than a bare
 * side-effect import) keeps the binding live so it is never tree-shaken.
 */
import { installEngineWorker } from "@joeee/engine-controller/worker";

installEngineWorker();
