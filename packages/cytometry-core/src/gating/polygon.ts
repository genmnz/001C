import type { Gate2D } from "./types.ts";

/**
 * Polygon gate via ray-casting (even-odd rule). This is the single hottest path
 * in interactive gating: on every drag the engine re-tests point-in-polygon over
 * the parent population. The vertex arrays are flattened and edge slopes are
 * precomputed in the constructor so `contains` is branchy-but-allocation-free;
 * the same algorithm is mirrored in the Rust/WASM SIMD kernel for large samples.
 *
 * Reference for the algorithm and edge-case handling: the FlowUtils gate C
 * extension (BSD-3, Duke University) and the classic PNPOLY method.
 */
export class PolygonGate implements Gate2D {
  readonly kind = "polygon";
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  private readonly n: number;
  // Axis-aligned bounding box for a cheap early-out.
  private readonly bx0: number;
  private readonly bx1: number;
  private readonly by0: number;
  private readonly by1: number;

  constructor(
    readonly xChannel: string,
    readonly yChannel: string,
    vertices: ReadonlyArray<readonly [number, number]>,
  ) {
    if (vertices.length < 3)
      throw new RangeError("polygon: need at least 3 vertices");
    this.n = vertices.length;
    this.xs = new Float64Array(this.n);
    this.ys = new Float64Array(this.n);
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (let i = 0; i < this.n; i++) {
      const vx = vertices[i][0];
      const vy = vertices[i][1];
      this.xs[i] = vx;
      this.ys[i] = vy;
      if (vx < x0) x0 = vx;
      if (vx > x1) x1 = vx;
      if (vy < y0) y0 = vy;
      if (vy > y1) y1 = vy;
    }
    this.bx0 = x0;
    this.bx1 = x1;
    this.by0 = y0;
    this.by1 = y1;
  }

  contains(x: number, y: number): boolean {
    // Bounding-box reject — most events fall outside a gate.
    if (x < this.bx0 || x > this.bx1 || y < this.by0 || y > this.by1)
      return false;
    const xs = this.xs;
    const ys = this.ys;
    const n = this.n;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = ys[i];
      const yj = ys[j];
      // Does the horizontal ray at y cross edge (j -> i)?
      if (yi > y !== yj > y) {
        const xCross = ((xs[j] - xs[i]) * (y - yi)) / (yj - yi) + xs[i];
        if (x < xCross) inside = !inside;
      }
    }
    return inside;
  }
}
