import { describe, expect, test } from "bun:test";
import { density } from "@joeee/cytometry-core";
import {
  SCATTER_QUAD,
  binIndex,
  packComputeParams,
  packRenderParams,
} from "../src/webgpu/layout.ts";

describe("WebGPU buffer packing", () => {
  test("packComputeParams lays out 4×u32 then 4×f32", () => {
    const ab = packComputeParams(512, 256, 1_000_000, {
      xMin: 0,
      xMax: 1,
      yMin: -2,
      yMax: 3,
    });
    expect(ab.byteLength).toBe(32);
    const u = new Uint32Array(ab, 0, 4);
    const f = new Float32Array(ab, 16, 4);
    expect(Array.from(u)).toEqual([512, 256, 1_000_000, 0]);
    expect(Array.from(f)).toEqual([0, 1, -2, 3]);
  });

  test("packRenderParams clamps maxCount to >= 1", () => {
    expect(Array.from(packRenderParams(8, 8, 0))).toEqual([8, 8, 1, 0]);
    expect(Array.from(packRenderParams(8, 8, 42))).toEqual([8, 8, 42, 0]);
  });

  test("scatter quad is two triangles (12 floats)", () => {
    expect(SCATTER_QUAD.length).toBe(12);
  });
});

describe("GPU bin formula == core histogram2d (source of truth)", () => {
  test("binIndex agrees with histogram2d bin assignment", () => {
    const vp = { xMin: 0, xMax: 4, yMin: 0, yMax: 4 };
    const binsX = 4;
    const binsY = 4;
    // Build counts two ways: via the GPU-side formula (binIndex) and via the
    // engine's histogram2d. They must produce identical count arrays.
    const xs = [0.5, 0.5, 0.5, 3.5, -1, 4, 2.0];
    const ys = [0.5, 0.5, 3.5, 3.5, 0.5, 2, 4];

    const viaGpuFormula = new Uint32Array(binsX * binsY);
    for (let i = 0; i < xs.length; i++) {
      const idx = binIndex(xs[i], ys[i], vp, binsX, binsY);
      if (idx >= 0) viaGpuFormula[idx]++;
    }

    const bins = density.histogram2d(xs, ys, { binsX, binsY, ...vp });
    expect(Array.from(viaGpuFormula)).toEqual(Array.from(bins.counts));
  });
});
