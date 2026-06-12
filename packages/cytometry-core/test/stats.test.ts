import { describe, expect, test } from "bun:test";
import {
  channelStats,
  frequency,
  median,
  percentile,
} from "../src/stats/index.ts";
import { Population } from "../src/population.ts";

describe("percentile / median", () => {
  test("median of odd and even counts", () => {
    expect(median(Float64Array.from([3, 1, 2]))).toBe(2);
    expect(median(Float64Array.from([1, 2, 3, 4]))).toBe(2.5);
  });
  test("percentile interpolates", () => {
    const s = Float64Array.from([0, 10, 20, 30, 40]);
    expect(percentile(s, 0)).toBe(0);
    expect(percentile(s, 100)).toBe(40);
    expect(percentile(s, 50)).toBe(20);
    expect(percentile(s, 25)).toBe(10);
  });
});

describe("channelStats", () => {
  test("computes count/mean/median/min/max over a population", () => {
    const column = [10, 20, 30, 40, 1000];
    const pop = new Population(5);
    [0, 1, 2, 3].forEach((i) => pop.set(i)); // exclude the outlier at index 4
    const s = channelStats(pop, column);
    expect(s.count).toBe(4);
    expect(s.mean).toBeCloseTo(25, 10);
    expect(s.median).toBeCloseTo(25, 10);
    expect(s.min).toBe(10);
    expect(s.max).toBe(40);
    expect(s.geometricMean).toBeCloseTo(Math.exp((Math.log(10) + Math.log(20) + Math.log(30) + Math.log(40)) / 4), 8);
  });
  test("empty population yields NaNs but a zero count", () => {
    const s = channelStats(new Population(5), [1, 2, 3, 4, 5]);
    expect(s.count).toBe(0);
    expect(Number.isNaN(s.mean)).toBe(true);
  });
});

describe("frequency", () => {
  test("ofParent and ofTotal", () => {
    const total = 100;
    const parent = new Population(total);
    for (let i = 0; i < 50; i++) parent.set(i); // parent = 50
    const child = new Population(total);
    for (let i = 0; i < 10; i++) child.set(i); // child = 10
    const f = frequency(child, parent, total);
    expect(f.count).toBe(10);
    expect(f.ofParent).toBeCloseTo(0.2, 10); // 10/50
    expect(f.ofTotal).toBeCloseTo(0.1, 10); // 10/100
  });
});
