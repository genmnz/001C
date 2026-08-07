/// <reference lib="webworker" />
import { defaultKernels, loadWasmKernels, type Kernels } from "@joeee/cytometry-core";
import { Engine } from "../engine.ts";

/**
 * The Worker host for the engine. The big EventMatrices live here, off the main
 * thread; the main thread only sends small request objects and receives small
 * results (counts, stats) or bin arrays for the renderer. With cross-origin
 * isolation enabled, the SharedArrayBuffer backing each matrix is visible to the
 * GPU uploader on the main thread without a copy, and the FCS bytes are
 * transferred in (moved, not copied) by createWorkerBackend.
 *
 * This module is browser/Worker-only (it references `self`/postMessage) and is
 * therefore not part of the Bun unit-test surface — the same Engine logic is
 * tested via the in-process backend. The bootstrap is exported as
 * `installEngineWorker` so a bundler-owned worker entry can call it on a relative
 * URL (the robust Vite pattern); it defaults to the current worker scope.
 */

type Method =
  | "loadFcs"
  | "addColumns"
  | "bin2d"
  | "evaluateGate"
  | "stats"
  | "compensate"
  | "cluster"
  | "embed"
  | "markerEnrichment"
  | "exportCsv";

interface RpcMessage {
  id: number;
  method: Method;
  args: unknown[];
}

/** The slice of the worker global the host needs — keeps callers lib-agnostic. */
export interface WorkerScope {
  onmessage: ((ev: MessageEvent) => unknown) | null;
  postMessage(message: unknown): void;
  crossOriginIsolated?: boolean;
}

/**
 * Default URL for the SIMD kernel artifact (build with `bun run build:wasm` and
 * serve it here). Absent → loadWasmKernels falls back to the pure-TS kernels, so
 * the worker always boots; building the wasm later lights up SIMD with no other
 * change.
 */
const WASM_KERNEL_URL = "/joeee_cytometry_wasm.wasm";

async function selectKernels(): Promise<Kernels> {
  try {
    // loadWasmKernels already falls back to TsKernels on any failure; the extra
    // guard covers environments where fetch itself is unavailable.
    return await loadWasmKernels(WASM_KERNEL_URL);
  } catch {
    return defaultKernels();
  }
}

/** Install the RPC message handler on a worker scope and boot the engine. */
export function installEngineWorker(
  scope: WorkerScope = self as unknown as WorkerScope,
): void {
  // Kernel selection is async (wasm fetch/compile); hold an engine promise and
  // await it per call so requests that arrive before boot completes still work.
  const ready = selectKernels().then((kernels) => {
    const engine = new Engine(kernels);
    scope.postMessage({
      type: "ready",
      backend: kernels.backend,
      crossOriginIsolated: scope.crossOriginIsolated === true,
    });
    return engine;
  });

  scope.onmessage = async (ev: MessageEvent<RpcMessage>) => {
    const data = ev.data;
    if (!data || typeof data.id !== "number") return; // ignore non-RPC messages
    const { id, method, args } = data;
    try {
      const engine = await ready;
      const fn = (engine as unknown as Record<Method, (...a: unknown[]) => unknown>)[
        method
      ];
      if (typeof fn !== "function") throw new Error(`unknown method: ${method}`);
      const result = fn.apply(engine, args);
      scope.postMessage({ id, ok: true, result });
    } catch (e) {
      scope.postMessage({
        id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
}
