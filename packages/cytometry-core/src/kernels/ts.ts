import { PolygonGate } from "../gating/polygon.ts";
import { LogicleTransform } from "../transforms/logicle.ts";
import type { Kernels } from "./types.ts";

/**
 * Pure-TypeScript kernels — the always-available default. Correct everywhere,
 * fast enough up to ~1–2M events; swap in WasmKernels for the 10M+ interactive
 * path. Validated identical to the WASM path in kernels.wasm.test.ts.
 */
export class TsKernels implements Kernels {
  readonly backend = "ts" as const;

  logicleScaleInto(
    col: Float32Array,
    T: number,
    W: number,
    M: number,
    A: number,
  ): void {
    const lg = new LogicleTransform(T, W, M, A);
    for (let i = 0; i < col.length; i++) col[i] = lg.scale(col[i]);
  }

  polygonMask(
    xs: Float32Array,
    ys: Float32Array,
    polyX: Float64Array,
    polyY: Float64Array,
  ): Uint8Array {
    const verts: [number, number][] = [];
    for (let i = 0; i < polyX.length; i++) verts.push([polyX[i], polyY[i]]);
    const gate = new PolygonGate("x", "y", verts);
    const out = new Uint8Array(xs.length);
    for (let i = 0; i < xs.length; i++) out[i] = gate.contains(xs[i], ys[i]) ? 1 : 0;
    return out;
  }
}
