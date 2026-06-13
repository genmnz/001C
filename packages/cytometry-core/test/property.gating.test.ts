import { describe, expect, test } from "bun:test";
import {
  PolygonGate,
  RectangleGate,
  evaluate2D,
} from "../src/gating/index.ts";
import { Population } from "../src/population.ts";
import { mulberry32, uniform } from "./helpers.ts";

/** Independent inside-test for a CCW convex polygon (all edge cross-products >= 0). */
function convexInside(
  vx: number[],
  vy: number[],
  px: number,
  py: number,
): boolean {
  const n = vx.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = (vx[j] - vx[i]) * (py - vy[i]) - (vy[j] - vy[i]) * (px - vx[i]);
    if (cross < 0) return false;
  }
  return true;
}

describe("PolygonGate vs independent convex reference (fuzz)", () => {
  const r = mulberry32(2024);
  for (let trial = 0; trial < 30; trial++) {
    const n = 5 + (trial % 5);
    const cx = uniform(r, -10, 10);
    const cy = uniform(r, -10, 10);
    const rad = uniform(r, 3, 20);
    // distinct sorted angles on a circle -> convex, CCW polygon
    const angs = Array.from({ length: n }, () => uniform(r, 0, 2 * Math.PI)).sort(
      (a, b) => a - b,
    );
    const vx = angs.map((a) => cx + rad * Math.cos(a));
    const vy = angs.map((a) => cy + rad * Math.sin(a));
    const verts = vx.map((x, i) => [x, vy[i]] as [number, number]);
    const gate = new PolygonGate("x", "y", verts);

    test(`convex polygon ${trial} (${n}-gon) membership matches`, () => {
      let mismatches = 0;
      for (let k = 0; k < 2000; k++) {
        const px = uniform(r, cx - rad - 3, cx + rad + 3);
        const py = uniform(r, cy - rad - 3, cy + rad + 3);
        const mine = gate.contains(px, py);
        const ref = convexInside(vx, vy, px, py);
        if (mine !== ref) mismatches++;
      }
      expect(mismatches).toBe(0);
    });
  }
});

describe("gate evaluation invariants", () => {
  const r = mulberry32(99);

  test("child gate is always a subset of its parent", () => {
    const n = 50_000;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = uniform(r, 0, 100);
      ys[i] = uniform(r, 0, 100);
    }
    const parent = evaluate2D(new RectangleGate("x", "y", 20, 80, 20, 80), xs, ys);
    const child = evaluate2D(
      new RectangleGate("x", "y", 40, 90, 10, 60),
      xs,
      ys,
      parent,
    );
    // child ⊆ parent  <=>  child AND parent == child
    expect(child.and(parent).count()).toBe(child.count());
  });

  test("RectangleGate count matches a naive loop at 1,000,000 events", () => {
    const n = 1_000_000;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = uniform(r, 0, 1000);
      ys[i] = uniform(r, 0, 1000);
    }
    const gate = new RectangleGate("x", "y", 100, 700, 250, 950);
    let naive = 0;
    for (let i = 0; i < n; i++) {
      if (xs[i] >= 100 && xs[i] < 700 && ys[i] >= 250 && ys[i] < 950) naive++;
    }
    const pop = evaluate2D(gate, xs, ys);
    expect(pop.count()).toBe(naive);
  });
});
