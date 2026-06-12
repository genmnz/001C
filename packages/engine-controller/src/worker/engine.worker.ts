/// <reference lib="webworker" />
import { Engine } from "../engine.ts";

/**
 * The Worker host for the engine. The big EventMatrices live here, off the main
 * thread; the main thread only sends small request objects and receives small
 * results (counts, stats) or bin arrays for the renderer. With cross-origin
 * isolation enabled, the SharedArrayBuffer backing each matrix is visible to the
 * GPU uploader on the main thread without a copy.
 *
 * This file is browser/Worker-only (it references `self`/postMessage) and is
 * therefore not part of the Bun unit-test surface — the same logic is tested via
 * the in-process backend.
 */
const engine = new Engine();

type Method =
  | "loadFcs"
  | "addColumns"
  | "bin2d"
  | "evaluateGate"
  | "stats";

interface RpcMessage {
  id: number;
  method: Method;
  args: unknown[];
}

self.onmessage = (ev: MessageEvent<RpcMessage>) => {
  const { id, method, args } = ev.data;
  try {
    // Dispatch to the matching engine method.
    const fn = (engine as unknown as Record<Method, (...a: unknown[]) => unknown>)[
      method
    ];
    if (typeof fn !== "function") throw new Error(`unknown method: ${method}`);
    const result = fn.apply(engine, args);
    (self as unknown as Worker).postMessage({ id, ok: true, result });
  } catch (e) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
