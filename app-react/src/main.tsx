import {
  EngineController,
  createInProcessBackend,
  createWorkerBackend,
} from "@joeee/engine-controller";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

/**
 * Bootstrap. The controller is the only object the UI holds. By default the
 * engine runs off the main thread in a Web Worker, so parsing/gating/stats on
 * real multi-GB files never block rendering or input. The controller talks to
 * the engine through the EngineApi, so the Worker vs in-process choice here is
 * the only line that differs.
 */
function makeController(): EngineController {
  if (typeof Worker !== "undefined") {
    try {
      const worker = new Worker(
        new URL("./engine.worker.ts", import.meta.url),
        { type: "module" },
      );
      // The worker reports its kernel backend (ts | wasm) and isolation status
      // once booted; surface it so the SAB/WASM path is observable.
      worker.addEventListener("message", (ev: MessageEvent) => {
        if (ev.data?.type === "ready") {
          console.info(
            `[joeee] engine worker ready — kernels: ${ev.data.backend}, ` +
              `crossOriginIsolated: ${ev.data.crossOriginIsolated}` +
              (ev.data.crossOriginIsolated
                ? " (SharedArrayBuffer zero-copy active)"
                : " (no SAB — results are copied across the thread boundary)"),
          );
        }
      });
      return new EngineController(createWorkerBackend(worker));
    } catch (e) {
      console.warn(
        "[joeee] Worker backend unavailable; running the engine on the main thread.",
        e,
      );
    }
  }
  return new EngineController(createInProcessBackend());
}

const controller = makeController();

createRoot(document.getElementById("root")!).render(<App controller={controller} />);
