import { describe, expect, test } from "bun:test";
import { dbscan } from "../src/cluster/dbscan.ts";
import { kde1d } from "../src/density/kde.ts";
import { quantileThreshold, tailThreshold } from "../src/autogate/threshold1d.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("kde1d", () => {
  test("integrates to ~1 and peaks near the data center", () => {
    const r = mulberry32(1);
    const n = 2000;
    const v = new Float64Array(n);
    // roughly normal around 50 (sum of uniforms)
    for (let i = 0; i < n; i++)
      v[i] = 50 + (uniform(r, -1, 1) + uniform(r, -1, 1) + uniform(r, -1, 1)) * 6;
    const k = kde1d(v, { min: 0, max: 100, bins: 256 });
    // trapezoidal integral ~ 1
    let area = 0;
    const dx = k.x[1] - k.x[0];
    for (let i = 1; i < k.density.length; i++)
      area += ((k.density[i] + k.density[i - 1]) / 2) * dx;
    expect(area).toBeGreaterThan(0.9);
    expect(area).toBeLessThan(1.1);
    // peak near 50
    let peak = 0;
    for (let i = 1; i < k.density.length; i++) if (k.density[i] > k.density[peak]) peak = i;
    expect(Math.abs(k.x[peak] - 50)).toBeLessThan(8);
  });
});

describe("quantile / tail thresholds", () => {
  test("quantileThreshold returns the value at the quantile", () => {
    const v = Array.from({ length: 100 }, (_, i) => i);
    expect(quantileThreshold(v, 0.5)).toBeCloseTo(50, 0);
    expect(quantileThreshold(v, 0.95)).toBeGreaterThan(90);
  });
  test("tailThreshold lands beyond the main peak", () => {
    const r = mulberry32(4);
    const v: number[] = [];
    for (let i = 0; i < 3000; i++) v.push(10 + uniform(r, -2, 2)); // main peak ~10
    for (let i = 0; i < 100; i++) v.push(80 + uniform(r, -5, 5)); // rare tail
    const t = tailThreshold(v, 0.05);
    // Cut lands just past the main mode's upper edge (~12), separating it from
    // the gap + rare tail — i.e. above the main population, below the tail blob.
    expect(t).toBeGreaterThan(11.5);
    expect(t).toBeLessThan(80);
  });
});

describe("dbscan", () => {
  test("separates two dense blobs and flags sparse noise", () => {
    const r = mulberry32(123);
    const xs: number[] = [];
    const ys: number[] = [];
    // blob A around (0,0)
    for (let i = 0; i < 200; i++) {
      xs.push(uniform(r, -1, 1));
      ys.push(uniform(r, -1, 1));
    }
    // blob B around (20,20)
    for (let i = 0; i < 200; i++) {
      xs.push(20 + uniform(r, -1, 1));
      ys.push(20 + uniform(r, -1, 1));
    }
    // far-flung noise
    const noiseIdx = [400, 401, 402];
    xs.push(100, -100, 200);
    ys.push(-100, 100, 200);

    const res = dbscan([xs, ys], 2, 5);
    expect(res.clusterCount).toBe(2);
    // each blob internally consistent
    const a = res.labels[0];
    const b = res.labels[200];
    expect(a).not.toBe(b);
    for (let i = 0; i < 200; i++) expect(res.labels[i]).toBe(a);
    for (let i = 200; i < 400; i++) expect(res.labels[i]).toBe(b);
    for (const i of noiseIdx) expect(res.labels[i]).toBe(-1);
  });
});
