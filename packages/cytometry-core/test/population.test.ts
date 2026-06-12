import { describe, expect, test } from "bun:test";
import { Population } from "../src/population.ts";
import { EventMatrix } from "../src/matrix.ts";

describe("Population (bitset)", () => {
  test("set/get/count and tail masking", () => {
    const p = new Population(70); // spans 3 words, 6 bits into the last
    p.set(0);
    p.set(69);
    expect(p.get(0)).toBe(true);
    expect(p.get(69)).toBe(true);
    expect(p.get(1)).toBe(false);
    expect(p.count()).toBe(2);
  });

  test("all() then not() yields empty (tail bits stay clean)", () => {
    const p = Population.all(70);
    expect(p.count()).toBe(70);
    expect(p.not().count()).toBe(0);
  });

  test("forEach visits exactly the set indices in order", () => {
    const p = new Population(100);
    const want = [0, 31, 32, 63, 64, 99];
    want.forEach((i) => p.set(i));
    const got: number[] = [];
    p.forEach((i) => got.push(i));
    expect(got).toEqual(want);
  });

  test("toMask expands to one byte per event", () => {
    const p = new Population(4);
    p.set(1);
    p.set(3);
    expect(Array.from(p.toMask())).toEqual([0, 1, 0, 1]);
  });
});

describe("EventMatrix", () => {
  test("column-major layout and channel lookup by name", () => {
    const m = EventMatrix.allocate(3, [
      { name: "FSC-A" },
      { name: "CD3", label: "CD3" },
    ]);
    m.columnByName("FSC-A").set([1, 2, 3]);
    m.columnByName("CD3").set([10, 20, 30]);
    expect(Array.from(m.column(0))).toEqual([1, 2, 3]);
    expect(m.value(2, 1)).toBe(30);
    expect(m.indexOf("CD3")).toBe(1);
    expect(() => m.indexOf("nope")).toThrow();
  });
});
