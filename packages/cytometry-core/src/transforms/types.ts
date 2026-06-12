/**
 * A scale transform maps raw cytometry channel values onto a display scale and
 * back. Implementations must be pure and allocation-free on the hot path so they
 * can be applied column-wise over millions of events (and later mirrored in the
 * Rust/WASM SIMD kernels without semantic drift).
 *
 * Convention: `scale()` maps a data value to display space; `unscale()` is its
 * inverse. For logicle/biexponential, display space is roughly [0, 1].
 */
export interface Transform {
  readonly kind: string;
  /** data value -> display scale */
  scale(value: number): number;
  /** display scale -> data value */
  unscale(value: number): number;
}

/**
 * Apply a transform to a contiguous column, writing into `dst` (which may alias
 * `src` only if same length/element type). This is the headless reference; the
 * GPU path applies the same math in a vertex/compute shader, and the WASM path
 * applies it with `simd128` — all three must agree to ~1e-6 (f64 reference).
 */
export function scaleInto(
  t: Transform,
  src: ArrayLike<number>,
  dst: Float32Array,
): Float32Array {
  const n = src.length;
  for (let i = 0; i < n; i++) dst[i] = t.scale(src[i]);
  return dst;
}
