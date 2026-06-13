import { describe, expect, test } from "bun:test";
import { Population } from "../src/population.ts";
import { channelStats, percentile } from "../src/stats/index.ts";
import { mulberry32, uniform } from "./helpers.ts";

// Reference implementations matching the engine's exact definitions
// (population variance /n; percentile via linear interpolation on rank).
function refPercentile(sorted: number[], p: number): number {
  const n = sorted.length;
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (rank - lo)) + sorted[hi] * (rank - lo);
}

describe("channelStats vs naive reference (fuzz)", () => {
  const r = mulberry32(7);
  for (let trial = 0; trial < 40; trial++) {
    test(`trial ${trial}`, () => {
      const n = 500 + Math.floor(r() * 4500);
      const col = new Float32Array(n);
      for (let i = 0; i < n; i++) col[i] = uniform(r, 1, 1e5); // positive -> geomean defined

      // Random subset population.
      const pop = new Population(n);
      const picked: number[] = [];
      for (let i = 0; i < n; i++) {
        if (r() < 0.5) {
          pop.set(i);
          picked.push(col[i]);
        }
      }
      if (picked.length < 2) {
        pop.set(0);
        pop.set(1);
        picked.length = 0;
        picked.push(col[0], col[1]);
      }

      const m = picked.length;
      const sum = picked.reduce((a, b) => a + b, 0);
      const mean = sum / m;
      const variance = picked.reduce((a, b) => a + (b - mean) ** 2, 0) / m;
      const stdev = Math.sqrt(variance);
      const sorted = [...picked].sort((a, b) => a - b);
      const median = refPercentile(sorted, 50);
      const devs = picked.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
      const mad = refPercentile(devs, 50);
      const geo = Math.exp(picked.reduce((a, b) => a + Math.log(b), 0) / m);

      const s = channelStats(pop, col);
      const rel = (got: number, exp: number) =>
        Math.abs(got - exp) / Math.max(1, Math.abs(exp));
      expect(s.count).toBe(m);
      expect(rel(s.mean, mean)).toBeLessThan(1e-5);
      expect(rel(s.stdev, stdev)).toBeLessThan(1e-4);
      expect(rel(s.median, median)).toBeLessThan(1e-5);
      expect(rel(s.mad, mad)).toBeLessThan(1e-5);
      expect(rel(s.geometricMean, geo)).toBeLessThan(1e-4);
      expect(rel(s.cv, (100 * stdev) / Math.abs(mean))).toBeLessThan(1e-4);
      expect(s.min).toBeCloseTo(Math.min(...picked), 3);
      expect(s.max).toBeCloseTo(Math.max(...picked), 3);
    });
  }
});

describe("percentile edges", () => {
  test("0/50/100 and interpolation", () => {
    const s = Float64Array.from([0, 10, 20, 30, 40]);
    expect(percentile(s, 0)).toBe(0);
    expect(percentile(s, 100)).toBe(40);
    expect(percentile(s, 50)).toBe(20);
    expect(percentile(s, 75)).toBe(30);
  });
});
