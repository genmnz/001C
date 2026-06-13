/**
 * Hot-loop kernels behind a tiny interface so the engine can run on either the
 * pure-TS implementation (always available, the default) or the Rust→WASM SIMD
 * implementation (when the .wasm artifact is built and loaded). The engine
 * depends on this interface, not on either backend — that's the "wire it and
 * magic happens" seam: build the wasm, hand the engine WasmKernels, and the same
 * call sites run SIMD with no other change.
 *
 * Only the genuinely hot operations live here (logicle over a column,
 * point-in-polygon over events). Everything else stays in plain TS.
 */
export interface Kernels {
  readonly backend: "ts" | "wasm";
  /** Apply logicle scale to a Float32 column IN PLACE. */
  logicleScaleInto(
    col: Float32Array,
    T: number,
    W: number,
    M: number,
    A: number,
  ): void;
  /** 0/1 membership mask for a polygon over display-space columns. */
  polygonMask(
    xs: Float32Array,
    ys: Float32Array,
    polyX: Float64Array,
    polyY: Float64Array,
  ): Uint8Array;
}
