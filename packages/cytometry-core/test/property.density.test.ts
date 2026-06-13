import { describe, expect, test } from "bun:test";
import { histogram1d, histogram2d } from "../src/density/index.ts";
import { Population } from "../src/population.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("histogram2d conservation & correctness (fuzz)", () => {
  const r = mulberry32(555);

  test("sum of bins == in-range points; max == max(counts)", () => {
    for (let trial = 0; trial < 20; trial++) {
      const n = 5000;
      const xs = new Float32Array(n);
      const ys = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        xs[i] = uniform(r, -1, 2);
        ys[i] = uniform(r, -1, 2);
      }
      const opts = { binsX: 32, binsY: 24, xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
      const h = histogram2d(xs, ys, opts);

      let inRange = 0;
      const naive = new Uint32Array(opts.binsX * opts.binsY);
      for (let i = 0; i < n; i++) {
        const x = xs[i];
        const y = ys[i];
        if (x < 0 || x >= 1 || y < 0 || y >= 1) continue;
        inRange++;
        const ix = ((x - 0) / 1) * opts.binsX | 0;
        const iy = ((y - 0) / 1) * opts.binsY | 0;
        naive[iy * opts.binsX + ix]++;
      }
      expect(h.counts.reduce((a, b) => a + b, 0)).toBe(inRange);
      expect(Array.from(h.counts)).toEqual(Array.from(naive));
      expect(h.max).toBe(Math.max(...naive));
    }
  });

  test("parent population restricts the histogram", () => {
    const n = 4000;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const parent = new Population(n);
    let inParentAndRange = 0;
    for (let i = 0; i < n; i++) {
      xs[i] = uniform(r, 0, 1);
      ys[i] = uniform(r, 0, 1);
      if (r() < 0.3) {
        parent.set(i);
        inParentAndRange++;
      }
    }
    const h = histogram2d(xs, ys, {
      binsX: 16,
      binsY: 16,
      xMin: 0,
      xMax: 1,
      yMin: 0,
      yMax: 1,
      parent,
    });
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(inParentAndRange);
  });

  test("scales to 500,000 events (conservation holds)", () => {
    const n = 500_000;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = uniform(r, 0, 1);
      ys[i] = uniform(r, 0, 1);
    }
    const h = histogram2d(xs, ys, {
      binsX: 256,
      binsY: 256,
      xMin: 0,
      xMax: 1,
      yMin: 0,
      yMax: 1,
    });
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(n); // all in range
  });
});

describe("histogram1d conservation", () => {
  const r = mulberry32(8);
  test("sum of bins == in-range points", () => {
    const n = 10000;
    const xs = new Float32Array(n);
    for (let i = 0; i < n; i++) xs[i] = uniform(r, -5, 15);
    const h = histogram1d(xs, 50, 0, 10);
    let inRange = 0;
    for (let i = 0; i < n; i++) if (xs[i] >= 0 && xs[i] < 10) inRange++;
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(inRange);
  });
});
