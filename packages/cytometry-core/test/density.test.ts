import { describe, expect, test } from "bun:test";
import { histogram1d, histogram2d } from "../src/density/index.ts";
import { Population } from "../src/population.ts";

describe("histogram2d", () => {
  test("bins points into the correct cells and tracks max", () => {
    // 4x4 grid over [0,4)x[0,4). Place points so we know each bin.
    const xs = [0.5, 0.5, 0.5, 3.5];
    const ys = [0.5, 0.5, 0.5, 3.5];
    const h = histogram2d(xs, ys, {
      binsX: 4,
      binsY: 4,
      xMin: 0,
      xMax: 4,
      yMin: 0,
      yMax: 4,
    });
    // Three points in bin (0,0), one in (3,3).
    expect(h.counts[0 * 4 + 0]).toBe(3);
    expect(h.counts[3 * 4 + 3]).toBe(1);
    expect(h.max).toBe(3);
    // Total binned equals number of in-range points.
    const total = h.counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });

  test("drops out-of-range points and honors a parent population", () => {
    const xs = [-1, 0.5, 5];
    const ys = [0.5, 0.5, 0.5];
    const all = histogram2d(xs, ys, {
      binsX: 2,
      binsY: 2,
      xMin: 0,
      xMax: 2,
      yMin: 0,
      yMax: 2,
    });
    expect(all.counts.reduce((a, b) => a + b, 0)).toBe(1); // only x=0.5 in range

    const parent = new Population(3); // empty -> nothing binned
    const none = histogram2d(xs, ys, {
      binsX: 2,
      binsY: 2,
      xMin: 0,
      xMax: 2,
      yMin: 0,
      yMax: 2,
      parent,
    });
    expect(none.max).toBe(0);
  });
});

describe("histogram1d", () => {
  test("bins a 1D column", () => {
    const xs = [0, 0, 1, 2, 9];
    const h = histogram1d(xs, 10, 0, 10);
    expect(h.counts[0]).toBe(2);
    expect(h.counts[9]).toBe(1);
    expect(h.max_count).toBe(2);
  });
});
