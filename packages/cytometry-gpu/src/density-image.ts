import type { density } from "@joeee/cytometry-core";
import { sampleColormap } from "./colormap.ts";

/**
 * Convert an engine-computed 2D histogram into RGBA pixels — the pure, testable
 * heart of the density plot. The Canvas2D fallback `putImageData`s the result;
 * the WebGPU path produces the same image in a fragment shader. Either way the
 * BINS come from @joeee/cytometry-core (one source of truth), so a density plot
 * can be snapshot-tested without a GPU.
 *
 * Log scaling is the cytometry default: event density spans orders of magnitude,
 * and linear scaling hides everything but the densest blob.
 */
export interface DensityImage {
  width: number;
  height: number;
  /** RGBA8, length width*height*4. Empty bins are transparent. ArrayBuffer-backed
   *  (not SharedArrayBuffer) so it can be handed straight to ImageData. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface DensityImageOptions {
  colormap?: string;
  scale?: "linear" | "log";
  /** Put bin row 0 at the bottom (cytometry convention: y increases upward). */
  flipY?: boolean;
}

export function densityToImage(
  bins: density.Bins2D,
  opts: DensityImageOptions = {},
): DensityImage {
  const { binsX, binsY, counts, max } = bins;
  const colormap = opts.colormap ?? "viridis";
  const useLog = (opts.scale ?? "log") === "log";
  const flipY = opts.flipY ?? true;
  const data = new Uint8ClampedArray(binsX * binsY * 4);
  const denom = useLog ? Math.log1p(max) : max;

  for (let iy = 0; iy < binsY; iy++) {
    const row = flipY ? binsY - 1 - iy : iy;
    for (let ix = 0; ix < binsX; ix++) {
      const count = counts[iy * binsX + ix];
      const px = (row * binsX + ix) * 4;
      if (count === 0 || denom === 0) {
        data[px + 3] = 0; // transparent
        continue;
      }
      const t = (useLog ? Math.log1p(count) : count) / denom;
      const [r, g, b] = sampleColormap(colormap, t);
      data[px] = r;
      data[px + 1] = g;
      data[px + 2] = b;
      data[px + 3] = 255;
    }
  }
  return { width: binsX, height: binsY, data };
}
