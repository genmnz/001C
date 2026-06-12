import type { density } from "@joeee/cytometry-core";

/**
 * The renderer abstraction — the fallback seam. The app stays WebGPU-first, but
 * coding to this interface means a Canvas2D (small-N / headless thumbnail) or a
 * future WebGL2 backend is a new implementation, not a rewrite. Given Firefox's
 * still-settling default-on status and the iOS-old-device gap (see
 * docs/DERISKING.md), that insurance is nearly free.
 */
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export type ColorMode =
  | { kind: "density"; colormap?: string; scale?: "linear" | "log" }
  | { kind: "uniform"; rgba: [number, number, number, number] }
  | { kind: "population"; rgba: [number, number, number, number] };

export interface ScatterFrame {
  /** Interleaved [x0,y0,x1,y1,...] display-space positions. */
  positions: Float32Array;
  count: number;
  viewport: Viewport;
  pointSize?: number;
  /** Optional per-event membership mask (0/1) for population coloring. */
  mask?: Uint8Array;
}

export interface Renderer {
  readonly backend: "webgpu" | "canvas2d";
  /** Render the event cloud directly (one instanced point per event). */
  drawScatter(frame: ScatterFrame, color: ColorMode): void;
  /** Render a precomputed 2D-histogram density field (engine-binned). */
  drawDensity(bins: density.Bins2D, colormap?: string, scale?: "linear" | "log"): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
