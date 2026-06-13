/**
 * Pure, GPU-free helpers for the WebGPU density path: buffer packing and the
 * bin-index formula. Extracted so the GPU pipeline's arithmetic is unit-testable
 * headlessly (no device, no canvas) and can be asserted IDENTICAL to
 * @joeee/cytometry-core's histogram2d — the density source of truth. The WGSL in
 * histogram.wgsl implements the same formula; if these tests pass, the shader and
 * the engine agree.
 */
import type { Viewport } from "../renderer.ts";

/** Pack the compute uniform (matches `Params` in histogram.wgsl): 4×u32, 4×f32. */
export function packComputeParams(
  binsX: number,
  binsY: number,
  count: number,
  vp: Viewport,
): ArrayBuffer {
  const ab = new ArrayBuffer(32);
  new Uint32Array(ab, 0, 4).set([binsX, binsY, count, 0]);
  new Float32Array(ab, 16, 4).set([vp.xMin, vp.xMax, vp.yMin, vp.yMax]);
  return ab;
}

/** Pack the render uniform (matches `Params` in density_render.wgsl). */
export function packRenderParams(
  binsX: number,
  binsY: number,
  maxCount: number,
): Uint32Array {
  return new Uint32Array([binsX, binsY, Math.max(1, maxCount), 0]);
}

/**
 * Bin index for an event, or -1 if out of range. Identical formula to
 * histogram.wgsl AND to histogram2d in cytometry-core (inclusive-min,
 * exclusive-max). Returns iy*binsX + ix (row-major), matching Bins2D.counts.
 */
export function binIndex(
  x: number,
  y: number,
  vp: Viewport,
  binsX: number,
  binsY: number,
): number {
  if (x < vp.xMin || x >= vp.xMax || y < vp.yMin || y >= vp.yMax) return -1;
  const ix = ((x - vp.xMin) / (vp.xMax - vp.xMin) * binsX) | 0;
  const iy = ((y - vp.yMin) / (vp.yMax - vp.yMin) * binsY) | 0;
  return iy * binsX + ix;
}

/** Unit-quad corners (two triangles) for instanced point rendering, matching
 *  the `corner` vertex attribute consumed by scatter.wgsl. */
export const SCATTER_QUAD = new Float32Array([
  -1, -1, 1, -1, 1, 1,
  -1, -1, 1, 1, -1, 1,
]);
