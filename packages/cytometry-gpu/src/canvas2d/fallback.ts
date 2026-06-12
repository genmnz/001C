import type { density } from "@joeee/cytometry-core";
import { densityToImage } from "../density-image.ts";
import type { ColorMode, Renderer, ScatterFrame } from "../renderer.ts";

/**
 * Canvas2D renderer — the compatibility floor and the headless thumbnail path.
 * Fine for the "tiny" datasets the friend correctly identified (≤~100k events),
 * for browsers without WebGPU, and for server/offscreen figure generation. It
 * reuses @joeee/cytometry-core's bins and this package's pure densityToImage, so
 * it produces the same picture as the WebGPU path (just slower).
 */
export class Canvas2DRenderer implements Renderer {
  readonly backend = "canvas2d" as const;
  private ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas2d: 2D context unavailable");
    this.ctx = ctx;
  }

  drawDensity(
    bins: density.Bins2D,
    colormap = "viridis",
    scale: "linear" | "log" = "log",
  ): void {
    const img = densityToImage(bins, { colormap, scale });
    const tmp = document.createElement("canvas");
    tmp.width = img.width;
    tmp.height = img.height;
    tmp.getContext("2d")!.putImageData(
      new ImageData(img.data, img.width, img.height),
      0,
      0,
    );
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(tmp, 0, 0, this.canvas.width, this.canvas.height);
  }

  drawScatter(frame: ScatterFrame, color: ColorMode): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    const { xMin, xMax, yMin, yMax } = frame.viewport;
    const rgba = "rgba" in color ? color.rgba : [33, 145, 140, 255];
    ctx.fillStyle = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${(rgba[3] ?? 255) / 255})`;
    const sx = width / (xMax - xMin);
    const sy = height / (yMax - yMin);
    const r = frame.pointSize ?? 1;
    const p = frame.positions;
    for (let i = 0; i < frame.count; i++) {
      const x = p[i * 2];
      const y = p[i * 2 + 1];
      if (x < xMin || x >= xMax || y < yMin || y >= yMax) continue;
      const px = (x - xMin) * sx;
      const py = height - (y - yMin) * sy; // flip Y to cytometry convention
      ctx.fillRect(px - r / 2, py - r / 2, r, r);
    }
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  dispose(): void {}
}
