/**
 * @joeee/cytometry-core — the headless, UI-agnostic flow cytometry engine.
 *
 * No DOM, no canvas, no framework imports anywhere in this package: every export
 * is unit-testable under `bun test` in Node/Bun. The "agnostic UI" boundary in
 * joeee is downstream of here — UIs talk to @joeee/engine-controller, which
 * orchestrates this engine in a Worker.
 */
export { EventMatrix } from "./matrix.ts";
export type { ChannelMeta } from "./matrix.ts";
export { Population } from "./population.ts";

export * from "./transforms/index.ts";
// Gate classes (RectangleGate, PolygonGate, ...) and evaluate1D/2D are top-level;
// the boolean operators stay under a `boolean` sub-namespace to avoid polluting
// the root with and/or/not.
export * from "./gating/index.ts";
export * as stats from "./stats/index.ts";
export * as compensation from "./compensation/index.ts";
export * as density from "./density/index.ts";
export * as reduce from "./reduce/index.ts";
export * as cluster from "./cluster/index.ts";
export * as graph from "./graph/index.ts";
export * as autogate from "./autogate/index.ts";
export * as cleaning from "./cleaning/index.ts";
export * as sample from "./sample/index.ts";
export * as diff from "./diff/index.ts";
export * as normalize from "./normalize/index.ts";
export * as cytof from "./cytof/index.ts";
export * as ml from "./ml/index.ts";
export * as spatial from "./spatial/index.ts";
export * as discovery from "./discovery/index.ts";
export * as multisample from "./multisample/index.ts";
export {
  defaultKernels,
  loadWasmKernels,
  TsKernels,
  WasmKernels,
} from "./kernels/index.ts";
export type { Kernels } from "./kernels/index.ts";
