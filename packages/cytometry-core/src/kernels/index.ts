export type { Kernels } from "./types.ts";
export { TsKernels } from "./ts.ts";
export { WasmKernels } from "./wasm.ts";

import type { Kernels } from "./types.ts";
import { TsKernels } from "./ts.ts";
import { WasmKernels } from "./wasm.ts";

/** The default kernels (pure TS). Always available, no build step. */
export function defaultKernels(): Kernels {
  return new TsKernels();
}

/**
 * Load the WASM kernels. `src` is a URL (browser/Bun fetch) or raw bytes. Falls
 * back to TsKernels if instantiation fails, so callers can always do:
 *   const kernels = await loadWasmKernels("/joeee_cytometry_wasm.wasm");
 * and get a working engine whether or not the wasm is present.
 */
export async function loadWasmKernels(
  src: string | BufferSource,
): Promise<Kernels> {
  try {
    const bytes =
      typeof src === "string" ? await (await fetch(src)).arrayBuffer() : src;
    const module = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module, {});
    return new WasmKernels(instance);
  } catch {
    return new TsKernels();
  }
}
