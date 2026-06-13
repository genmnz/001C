import type { EngineController, WorkspaceState } from "@joeee/engine-controller";
import { useSyncExternalStore } from "react";

/**
 * The entire React↔engine binding. `useSyncExternalStore` subscribes to the
 * controller's observable store; React re-renders on view-state changes. The
 * EventMatrix and Population bitsets are NOT here — they live in the engine.
 * This hook is the whole reason the UI is swappable: Solid/Svelte wrap the same
 * `store.subscribe` differently, nothing else changes.
 */
export function useWorkspace(controller: EngineController): WorkspaceState {
  return useSyncExternalStore(controller.store.subscribe, controller.store.get);
}
