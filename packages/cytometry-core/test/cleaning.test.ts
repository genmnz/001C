import { describe, expect, test } from "bun:test";
import {
  SingletGate,
  debrisGate,
  saturationMask,
  timeWindowMask,
} from "../src/cleaning/index.ts";

describe("SingletGate", () => {
  const g = new SingletGate("FSC-A", "FSC-H", 0.8, 1.2);
  test("keeps near-diagonal (singlets), rejects high area/height (doublets)", () => {
    expect(g.contains(100, 100)).toBe(true); // ratio 1.0
    expect(g.contains(90, 100)).toBe(true); // 0.9
    expect(g.contains(200, 100)).toBe(false); // 2.0 -> doublet
    expect(g.contains(50, 100)).toBe(false); // 0.5
    expect(g.contains(10, 0)).toBe(false); // guard height<=0
  });
});

describe("debrisGate", () => {
  test("keeps events above the scatter minimums", () => {
    const g = debrisGate("FSC-A", "SSC-A", 10, 10);
    expect(g.contains(5, 50)).toBe(false); // below FSC min
    expect(g.contains(50, 5)).toBe(false); // below SSC min
    expect(g.contains(50, 50)).toBe(true);
  });
});

describe("saturationMask", () => {
  test("drops events at the saturation ceiling", () => {
    const pop = saturationMask([10, 20, 262144, 5], 262144);
    expect(pop.count()).toBe(3);
    expect(pop.get(2)).toBe(false);
  });
});

describe("timeWindowMask", () => {
  test("keeps events within [tMin, tMax)", () => {
    const pop = timeWindowMask([0, 5, 10, 15], 5, 12);
    expect(pop.count()).toBe(2);
    expect(pop.get(0)).toBe(false);
    expect(pop.get(1)).toBe(true);
    expect(pop.get(2)).toBe(true);
    expect(pop.get(3)).toBe(false);
  });
});
