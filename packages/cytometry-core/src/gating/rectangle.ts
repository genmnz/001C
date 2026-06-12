import type { Gate2D } from "./types.ts";

/** Axis-aligned rectangle gate; bounds are inclusive on min, exclusive on max. */
export class RectangleGate implements Gate2D {
  readonly kind = "rectangle";
  constructor(
    readonly xChannel: string,
    readonly yChannel: string,
    readonly xMin: number,
    readonly xMax: number,
    readonly yMin: number,
    readonly yMax: number,
  ) {}
  contains(x: number, y: number): boolean {
    return x >= this.xMin && x < this.xMax && y >= this.yMin && y < this.yMax;
  }
}
