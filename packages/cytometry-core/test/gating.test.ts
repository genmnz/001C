import { describe, expect, test } from "bun:test";
import {
  EllipseGate,
  PolygonGate,
  RangeGate,
  RectangleGate,
  evaluate1D,
  evaluate2D,
  quadrant,
  boolean,
} from "../src/gating/index.ts";
import { Population } from "../src/population.ts";

describe("RectangleGate", () => {
  test("inclusive-min / exclusive-max membership", () => {
    const g = new RectangleGate("x", "y", 0, 10, 0, 10);
    expect(g.contains(0, 0)).toBe(true);
    expect(g.contains(9.99, 9.99)).toBe(true);
    expect(g.contains(10, 5)).toBe(false); // max exclusive
    expect(g.contains(-1, 5)).toBe(false);
  });

  test("evaluate2D over columns counts correctly and respects parent", () => {
    const xs = [1, 2, 3, 20, 21];
    const ys = [1, 2, 3, 20, 21];
    const g = new RectangleGate("x", "y", 0, 10, 0, 10);
    const pop = evaluate2D(g, xs, ys);
    expect(pop.count()).toBe(3);

    // Restrict to a parent that excludes index 0.
    const parent = new Population(5);
    parent.set(1);
    parent.set(2);
    const child = evaluate2D(g, xs, ys, parent);
    expect(child.count()).toBe(2);
    expect(child.get(0)).toBe(false);
  });
});

describe("PolygonGate (ray casting)", () => {
  // A unit square as a polygon; test points inside, outside, and on the bbox.
  const square = new PolygonGate("x", "y", [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]);
  test("classifies interior and exterior points", () => {
    expect(square.contains(5, 5)).toBe(true);
    expect(square.contains(-1, 5)).toBe(false);
    expect(square.contains(11, 5)).toBe(false);
    expect(square.contains(5, 11)).toBe(false);
  });
  test("handles a concave polygon", () => {
    // An arrow/notch shape (concave at the top middle).
    const concave = new PolygonGate("x", "y", [
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 4],
      [0, 10],
    ]);
    expect(concave.contains(5, 1)).toBe(true); // low middle, inside
    expect(concave.contains(5, 8)).toBe(false); // in the notch, outside
  });
  test("rejects degenerate polygons", () => {
    expect(() => new PolygonGate("x", "y", [[0, 0], [1, 1]])).toThrow();
  });
});

describe("EllipseGate", () => {
  test("axis-aligned membership", () => {
    const e = new EllipseGate("x", "y", 0, 0, 10, 5, 0);
    expect(e.contains(0, 0)).toBe(true);
    expect(e.contains(10, 0)).toBe(true); // on boundary
    expect(e.contains(0, 5)).toBe(true);
    expect(e.contains(9, 4)).toBe(false); // outside the tilted boundary
  });
  test("rotated 90deg swaps effective axes", () => {
    const e = new EllipseGate("x", "y", 0, 0, 10, 5, Math.PI / 2);
    expect(e.contains(0, 10)).toBe(true); // long axis now vertical
    expect(e.contains(10, 0)).toBe(false);
  });
});

describe("RangeGate (1D)", () => {
  test("interval membership and evaluate1D", () => {
    const g = new RangeGate("x", 2, 5);
    const xs = [1, 2, 3, 4, 5, 6];
    const pop = evaluate1D(g, xs);
    expect(pop.count()).toBe(3); // 2,3,4
    expect(pop.get(0)).toBe(false);
    expect(pop.get(4)).toBe(false); // 5 is exclusive-max
  });
});

describe("quadrant", () => {
  test("splits into four regions summing to total", () => {
    //          x:  -1     1     -1     1      0
    const xs = [-1, 1, -1, 1, 0];
    const ys = [1, 1, -1, -1, 1];
    const q = quadrant(xs, ys, 0, 0);
    // x>=0 and y>=0 are "right" / "upper". (0,1) has x>=0 -> upperRight.
    expect(q.upperRight.count()).toBe(2); // (1,1) and (0,1)
    expect(q.upperLeft.count()).toBe(1); // (-1,1)
    expect(q.lowerLeft.count()).toBe(1); // (-1,-1)
    expect(q.lowerRight.count()).toBe(1); // (1,-1)
    const total =
      q.upperLeft.count() +
      q.upperRight.count() +
      q.lowerLeft.count() +
      q.lowerRight.count();
    expect(total).toBe(5);
  });
});

describe("boolean gates", () => {
  test("AND / OR / NOT / difference over populations", () => {
    const a = new Population(8);
    const b = new Population(8);
    [0, 1, 2, 3].forEach((i) => a.set(i));
    [2, 3, 4, 5].forEach((i) => b.set(i));
    expect(boolean.and(a, b).count()).toBe(2); // {2,3}
    expect(boolean.or(a, b).count()).toBe(6); // {0,1,2,3,4,5}
    expect(boolean.difference(a, b).count()).toBe(2); // {0,1}
    expect(boolean.not(a).count()).toBe(4); // {4,5,6,7}
  });
});
