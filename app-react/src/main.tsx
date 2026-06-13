import { EngineController, createInProcessBackend } from "@joeee/engine-controller";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

/**
 * Bootstrap. The controller is the only object the UI holds. For real data, run
 * the engine off-thread with the Worker backend:
 *
 *   import { createWorkerBackend } from "@joeee/engine-controller";
 *   const worker = new Worker(
 *     new URL("@joeee/engine-controller/worker", import.meta.url),
 *     { type: "module" },
 *   );
 *   const controller = new EngineController(createWorkerBackend(worker));
 */
const controller = new EngineController(createInProcessBackend());

createRoot(document.getElementById("root")!).render(<App controller={controller} />);
