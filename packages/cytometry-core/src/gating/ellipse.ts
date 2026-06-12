import type { Gate2D } from "./types.ts";

/**
 * Rotated ellipse gate. Defined by center (cx, cy), semi-axes (rx, ry) and a
 * rotation `angle` (radians, CCW). A point is inside iff, after rotating into
 * the ellipse's local frame, (x'/rx)^2 + (y'/ry)^2 <= 1.
 */
export class EllipseGate implements Gate2D {
  readonly kind = "ellipse";
  private readonly cos: number;
  private readonly sin: number;
  constructor(
    readonly xChannel: string,
    readonly yChannel: string,
    readonly cx: number,
    readonly cy: number,
    readonly rx: number,
    readonly ry: number,
    readonly angle = 0,
  ) {
    if (rx <= 0 || ry <= 0) throw new RangeError("ellipse: radii must be > 0");
    this.cos = Math.cos(angle);
    this.sin = Math.sin(angle);
  }
  contains(x: number, y: number): boolean {
    const dx = x - this.cx;
    const dy = y - this.cy;
    // Rotate by -angle into the ellipse's local frame.
    const xl = dx * this.cos + dy * this.sin;
    const yl = -dx * this.sin + dy * this.cos;
    const nx = xl / this.rx;
    const ny = yl / this.ry;
    return nx * nx + ny * ny <= 1;
  }
}
