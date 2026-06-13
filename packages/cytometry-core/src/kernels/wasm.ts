import type { Kernels } from "./types.ts";

/**
 * WASM kernels — wraps the joeee-cytometry-wasm module (raw C ABI). Data is
 * staged into the module's linear memory above `__heap_base`, the kernel runs in
 * place, and results are read back. For the production zero-copy path the event
 * matrix would live in the module's (shared) memory directly; this staging
 * wrapper is the simple, correct default and the validation target.
 *
 * No dependency on how the module was obtained — pass an already-instantiated
 * WebAssembly.Instance. Use loadWasmKernels() for the common fetch path.
 */
interface WasmExports {
  memory: WebAssembly.Memory;
  __heap_base: WebAssembly.Global;
  logicle_scale_into(
    ptr: number,
    len: number,
    t: number,
    w: number,
    m: number,
    a: number,
  ): void;
  polygon_mask(
    xs: number,
    ys: number,
    n: number,
    px: number,
    py: number,
    pn: number,
    out: number,
  ): void;
}

const align = (x: number, to: number): number => (x + (to - 1)) & ~(to - 1);

export class WasmKernels implements Kernels {
  readonly backend = "wasm" as const;
  private readonly ex: WasmExports;
  private readonly base: number;

  constructor(instance: WebAssembly.Instance) {
    this.ex = instance.exports as unknown as WasmExports;
    const hb = this.ex.__heap_base as unknown as { value?: number };
    this.base = align(hb?.value ?? 0x10000, 8);
  }

  private ensure(bytes: number): void {
    const need = this.base + bytes;
    const have = this.ex.memory.buffer.byteLength;
    if (need > have) {
      this.ex.memory.grow(Math.ceil((need - have) / 65536));
    }
  }

  logicleScaleInto(
    col: Float32Array,
    T: number,
    W: number,
    M: number,
    A: number,
  ): void {
    const n = col.length;
    this.ensure(n * 4);
    // Views must be recreated after any grow (the buffer may be replaced).
    new Float32Array(this.ex.memory.buffer, this.base, n).set(col);
    this.ex.logicle_scale_into(this.base, n, T, W, M, A);
    col.set(new Float32Array(this.ex.memory.buffer, this.base, n));
  }

  polygonMask(
    xs: Float32Array,
    ys: Float32Array,
    polyX: Float64Array,
    polyY: Float64Array,
  ): Uint8Array {
    const n = xs.length;
    const pn = polyX.length;
    const xsPtr = this.base; // 8-aligned
    const ysPtr = align(xsPtr + n * 4, 4);
    const pxPtr = align(ysPtr + n * 4, 8);
    const pyPtr = pxPtr + pn * 8;
    const outPtr = pyPtr + pn * 8;
    this.ensure(outPtr - this.base + n);

    const buf = this.ex.memory.buffer;
    new Float32Array(buf, xsPtr, n).set(xs);
    new Float32Array(buf, ysPtr, n).set(ys);
    new Float64Array(buf, pxPtr, pn).set(polyX);
    new Float64Array(buf, pyPtr, pn).set(polyY);

    this.ex.polygon_mask(xsPtr, ysPtr, n, pxPtr, pyPtr, pn, outPtr);

    return new Uint8Array(buf, outPtr, n).slice();
  }
}
