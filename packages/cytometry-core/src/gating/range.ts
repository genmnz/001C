import type { Gate1D } from "./types.ts";

/** 1D interval gate (a histogram "range"), inclusive-min / exclusive-max. */
export class RangeGate implements Gate1D {
  readonly kind = "range";
  constructor(
    readonly channel: string,
    readonly min: number,
    readonly max: number,
  ) {}
  contains(x: number): boolean {
    return x >= this.min && x < this.max;
  }
}
