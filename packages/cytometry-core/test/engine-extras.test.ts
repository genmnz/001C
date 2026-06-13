import { describe, expect, test } from "bun:test";
import { marginMask } from "../src/cleaning/index.ts";
import { hexbin } from "../src/density/hexbin.ts";
import { marchingSquares } from "../src/density/contour.ts";
import { EventMatrix } from "../src/matrix.ts";
import { estimateLogicleW } from "../src/transforms/estimateLogicle.ts";
import { QuantileTransform } from "../src/transforms/quantile.ts";
import { LogicleTransform } from "../src/transforms/logicle.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("marginMask", () => {
  test("drops events at instrument extremes", () => {
    const m = EventMatrix.allocate(4, [{ name: "x" }, { name: "y" }]);
    m.column(0).set([0, 50, 100, 50]); // 0 and 100 are margins
    m.column(1).set([50, 50, 50, 50]);
    const keep = marginMask(m, { x: [0, 100], y: [0, 100] });
    expect(keep.count()).toBe(2); // indices 1 and 3
    expect(keep.get(0)).toBe(false);
    expect(keep.get(2)).toBe(false);
  });
});

describe("estimateLogicleW", () => {
  test("returns a valid W in (0, M/2] for data with a negative tail", () => {
    const r = mulberry32(3);
    const vals: number[] = [];
    for (let i = 0; i < 5000; i++) vals.push(uniform(r, -500, 1000));
    const w = estimateLogicleW(vals, 262144, 4.5);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(4.5 / 2);
    // produces a usable transform
    const lg = new LogicleTransform(262144, w, 4.5, 0);
    expect(lg.unscale(lg.scale(1000))).toBeCloseTo(1000, 2);
  });
  test("no negatives -> default W", () => {
    expect(estimateLogicleW([1, 2, 3])).toBe(0.5);
  });
});

describe("QuantileTransform", () => {
  const t = new QuantileTransform(Array.from({ length: 100 }, (_, i) => i));
  test("empirical CDF is monotone and bounded", () => {
    expect(t.scale(-10)).toBeCloseTo(0, 6);
    expect(t.scale(99)).toBeCloseTo(1, 6);
    expect(t.scale(49)).toBeGreaterThan(t.scale(10));
  });
  test("inverse CDF returns reference values", () => {
    expect(t.unscale(0)).toBe(0);
    expect(t.unscale(0.5)).toBe(50);
  });
});

describe("marchingSquares", () => {
  test("single cell, one crossing -> one interpolated segment", () => {
    // 2x2 field: TL=0,TR=0,BR=2,BL=0; threshold 1 -> case 2 (BR only).
    const field = [0, 0, 0, 2]; // row-major: (0,0)=0,(1,0)=0,(0,1)=0,(1,1)=2
    const segs = marchingSquares(field, 2, 2, 1);
    expect(segs).toHaveLength(1);
    // crossing on right edge (1,0.5) and bottom edge (0.5,1)
    const s = segs[0];
    const pts = [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ].sort((a, b) => a[0] - b[0]);
    expect(pts[0][0]).toBeCloseTo(0.5, 6); // bottom x
    expect(pts[0][1]).toBeCloseTo(1, 6);
    expect(pts[1][0]).toBeCloseTo(1, 6); // right
    expect(pts[1][1]).toBeCloseTo(0.5, 6);
  });
  test("uniform field below/above threshold -> no segments", () => {
    expect(marchingSquares([0, 0, 0, 0], 2, 2, 1)).toHaveLength(0);
    expect(marchingSquares([5, 5, 5, 5], 2, 2, 1)).toHaveLength(0);
  });
});

describe("hexbin", () => {
  test("conserves counts and groups identical points", () => {
    const r = mulberry32(9);
    const n = 5000;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = uniform(r, 0, 100);
      ys[i] = uniform(r, 0, 100);
    }
    const bins = hexbin(xs, ys, 5);
    const total = bins.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(n); // every point in exactly one hex
    // identical points -> one bin
    const same = hexbin([10, 10, 10], [20, 20, 20], 5);
    expect(same).toHaveLength(1);
    expect(same[0].count).toBe(3);
  });
});
