import { describe, expect, test } from "bun:test";
import { Store } from "../src/store.ts";

describe("Store", () => {
  test("set with a patch and with an updater fn", () => {
    const s = new Store({ a: 1, b: 2 });
    s.set({ a: 10 });
    expect(s.get()).toEqual({ a: 10, b: 2 });
    s.set((cur) => ({ b: cur.a + 1 }));
    expect(s.get()).toEqual({ a: 10, b: 11 });
  });

  test("notifies subscribers and supports unsubscribe", () => {
    const s = new Store({ n: 0 });
    const seen: number[] = [];
    const unsub = s.subscribe((state) => seen.push(state.n));
    s.set({ n: 1 });
    s.set({ n: 2 });
    unsub();
    s.set({ n: 3 });
    expect(seen).toEqual([1, 2]); // no 3 after unsubscribe
  });
});
