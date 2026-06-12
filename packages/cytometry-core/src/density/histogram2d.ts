import { Population } from "../population.ts";

/**
 * CPU 2D histogram — the SOURCE OF TRUTH for density plots. The production
 * renderer computes the same bins in a WebGPU compute shader (atomic adds into a
 * storage buffer) for smooth pan/zoom on millions of points, but that GPU path
 * must produce bins identical to this function, which is what lets density plots
 * be regression-tested headlessly (see docs/DERISKING.md — "headless-first means
 * the binning math lives in the engine, the shader only accelerates it").
 *
 * Events are binned in display space (callers pass already-transformed columns).
 */
export interface Bins2D {
  binsX: number;
  binsY: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Row-major counts, length binsX*binsY (bin (ix,iy) at iy*binsX + ix). */
  counts: Uint32Array;
  /** Largest single-bin count, for color-map normalization. */
  max: number;
}

export interface Bin2DOptions {
  binsX: number;
  binsY: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  parent?: Population;
}

export function histogram2d(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  opts: Bin2DOptions,
): Bins2D {
  const { binsX, binsY, xMin, xMax, yMin, yMax, parent } = opts;
  const counts = new Uint32Array(binsX * binsY);
  const sx = binsX / (xMax - xMin);
  const sy = binsY / (yMax - yMin);

  const add = (i: number) => {
    const x = xs[i];
    const y = ys[i];
    if (x < xMin || x >= xMax || y < yMin || y >= yMax) return;
    const ix = ((x - xMin) * sx) | 0;
    const iy = ((y - yMin) * sy) | 0;
    counts[iy * binsX + ix]++;
  };

  if (parent) parent.forEach(add);
  else for (let i = 0; i < xs.length; i++) add(i);

  let max = 0;
  for (let i = 0; i < counts.length; i++) if (counts[i] > max) max = counts[i];

  return { binsX, binsY, xMin, xMax, yMin, yMax, counts, max };
}

/**
 * 1D histogram for single-parameter displays (the histogram plot type).
 */
export interface Bins1D {
  bins: number;
  min: number;
  max: number;
  counts: Uint32Array;
  max_count: number;
}

export function histogram1d(
  xs: ArrayLike<number>,
  bins: number,
  min: number,
  max: number,
  parent?: Population,
): Bins1D {
  const counts = new Uint32Array(bins);
  const s = bins / (max - min);
  const add = (i: number) => {
    const x = xs[i];
    if (x < min || x >= max) return;
    counts[((x - min) * s) | 0]++;
  };
  if (parent) parent.forEach(add);
  else for (let i = 0; i < xs.length; i++) add(i);
  let mc = 0;
  for (let i = 0; i < counts.length; i++) if (counts[i] > mc) mc = counts[i];
  return { bins, min, max, counts, max_count: mc };
}
