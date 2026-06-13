import { describe, expect, test } from "bun:test";
import { densityValley, otsuThreshold } from "../src/autogate/threshold1d.ts";
import { mulberry32 } from "./helpers.ts";

function gauss(r: () => number, mean: number, sd: number): number {
  // Box–Muller
  const u = Math.max(1e-9, r());
  const v = r();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

describe("1D auto-thresholding on bimodal data", () => {
  const r = mulberry32(2024);
  const n = 5000;
  const values = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) values[i] = gauss(r, 10, 3); // low mode
  for (let i = 0; i < n; i++) values[n + i] = gauss(r, 100, 12); // high mode

  const countBelow = (t: number) => {
    let c = 0;
    for (let i = 0; i < values.length; i++) if (values[i] < t) c++;
    return c;
  };

  test("Otsu threshold lands between the modes and splits ~50/50", () => {
    const t = otsuThreshold(values);
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(90);
    expect(Math.abs(countBelow(t) - n)).toBeLessThan(n * 0.1); // ~5000 below
  });

  test("density valley also separates the modes", () => {
    const t = densityValley(values);
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(90);
    expect(Math.abs(countBelow(t) - n)).toBeLessThan(n * 0.15);
  });

  test("unimodal data falls back to Otsu without throwing", () => {
    const uni = new Float64Array(1000);
    const r2 = mulberry32(5);
    for (let i = 0; i < uni.length; i++) uni[i] = gauss(r2, 50, 5);
    expect(Number.isFinite(densityValley(uni))).toBe(true);
  });
});
