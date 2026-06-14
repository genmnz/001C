import { describe, expect, test } from "bun:test";
import { agglomerative } from "../src/cluster/hierarchical.ts";
import { kde2d } from "../src/density/kde.ts";
import { mds } from "../src/reduce/mds.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("mds", () => {
  test("recovers planar configuration: embedded distances match originals", () => {
    // 40 points in a 2D plane, embedded in 5D (extra dims = 0).
    const r = mulberry32(2);
    const n = 40;
    const cols: Float64Array[] = Array.from({ length: 5 }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
      cols[0][i] = uniform(r, -10, 10);
      cols[1][i] = uniform(r, -10, 10);
      // cols 2-4 stay 0
    }
    const Y = mds(cols, { dims: 2 });
    // Compare pairwise distances (embedding vs original) — should be ~identical.
    let num = 0;
    let den1 = 0;
    let den2 = 0;
    let mo = 0;
    let me = 0;
    const od: number[] = [];
    const ed: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const oDist = Math.hypot(cols[0][i] - cols[0][j], cols[1][i] - cols[1][j]);
        const eDist = Math.hypot(Y[i][0] - Y[j][0], Y[i][1] - Y[j][1]);
        od.push(oDist);
        ed.push(eDist);
        mo += oDist;
        me += eDist;
      }
    }
    mo /= od.length;
    me /= ed.length;
    for (let t = 0; t < od.length; t++) {
      num += (od[t] - mo) * (ed[t] - me);
      den1 += (od[t] - mo) ** 2;
      den2 += (ed[t] - me) ** 2;
    }
    const corr = num / Math.sqrt(den1 * den2);
    expect(corr).toBeGreaterThan(0.99);
  });
});

describe("agglomerative", () => {
  test("average-linkage cut at k=3 recovers separated blobs", () => {
    const r = mulberry32(8);
    const per = 25;
    const centers = [
      [0, 0],
      [20, 0],
      [0, 20],
    ];
    const x = new Float64Array(per * 3);
    const y = new Float64Array(per * 3);
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < per; i++) {
        const k = c * per + i;
        x[k] = centers[c][0] + uniform(r, -1.5, 1.5);
        y[k] = centers[c][1] + uniform(r, -1.5, 1.5);
      }
    }
    const res = agglomerative([x, y], 3, { linkage: "average" });
    expect(res.k).toBe(3);
    for (let c = 0; c < 3; c++) {
      const lbl = res.labels[c * per];
      for (let i = 1; i < per; i++) expect(res.labels[c * per + i]).toBe(lbl);
    }
    expect(new Set([res.labels[0], res.labels[per], res.labels[2 * per]]).size).toBe(3);
  });
});

describe("kde2d", () => {
  test("integrates to ~1 and peaks at the data center", () => {
    const r = mulberry32(5);
    const n = 800;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = 50 + (uniform(r, -1, 1) + uniform(r, -1, 1) + uniform(r, -1, 1)) * 4;
      y[i] = 50 + (uniform(r, -1, 1) + uniform(r, -1, 1) + uniform(r, -1, 1)) * 4;
    }
    const k = kde2d(x, y, { binsX: 40, binsY: 40, extent: [20, 80, 20, 80] });
    const cellX = (k.xMax - k.xMin) / (k.binsX - 1);
    const cellY = (k.yMax - k.yMin) / (k.binsY - 1);
    let integral = 0;
    let peak = 0;
    for (let i = 0; i < k.density.length; i++) {
      integral += k.density[i] * cellX * cellY;
      if (k.density[i] > k.density[peak]) peak = i;
    }
    expect(integral).toBeGreaterThan(0.85);
    expect(integral).toBeLessThan(1.15);
    const px = k.xMin + (peak % k.binsX) * cellX;
    const py = k.yMin + Math.floor(peak / k.binsX) * cellY;
    expect(Math.abs(px - 50)).toBeLessThan(8);
    expect(Math.abs(py - 50)).toBeLessThan(8);
  });
});
