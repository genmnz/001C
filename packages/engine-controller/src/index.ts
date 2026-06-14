/**
 * @joeee/engine-controller — the UI-agnostic boundary.
 *
 * A UI (React, Solid, Svelte, or none) constructs an EngineController with a
 * backend and then only ever: (1) calls command methods, (2) subscribes to
 * `controller.store`. It never imports @joeee/cytometry-core or touches an
 * EventMatrix. That is the headless-engine / agnostic-UI separation, enforced by
 * module boundaries rather than convention.
 */
export { EngineController } from "./controller.ts";
export { Store } from "./store.ts";
export type { Updater } from "./store.ts";
export { Engine } from "./engine.ts";
// Pure presentational helper: build a Transform from a spec (e.g. for axis ticks)
// without the UI importing the engine core directly.
export { makeTransform as buildTransform } from "./factories.ts";
export type { Transform } from "@joeee/cytometry-core";
export {
  createInProcessBackend,
  createWorkerBackend,
  type EngineApi,
} from "./backend.ts";
export * from "./protocol.ts";
export {
  serializeWorkspace,
  deserializeWorkspace,
  topoSortGates,
} from "./workspace.ts";
export type { WorkspaceDoc, SerializedGate } from "./workspace.ts";
export { parseGatingML } from "./interop/gatingml.ts";
export { parseXml } from "./interop/xml.ts";
