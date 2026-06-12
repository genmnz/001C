/**
 * A tiny framework-agnostic observable store. No React, no Solid, no Svelte —
 * those wrap it at the edges:
 *   React:  useSyncExternalStore(store.subscribe, store.get)
 *   Solid:  a signal fed by store.subscribe
 *   Svelte: { subscribe: store.subscribe } is already a Svelte store
 *
 * It holds only view state (see WorkspaceState). The large event matrices and
 * population bitsets never come near it.
 */
export type Updater<T> = Partial<T> | ((state: T) => Partial<T>);

export class Store<T extends object> {
  private state: T;
  private readonly subscribers = new Set<(state: T) => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  get = (): T => this.state;

  set(updater: Updater<T>): void {
    const patch =
      typeof updater === "function" ? updater(this.state) : updater;
    this.state = { ...this.state, ...patch };
    for (const fn of this.subscribers) fn(this.state);
  }

  subscribe = (fn: (state: T) => void): (() => void) => {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  };
}
