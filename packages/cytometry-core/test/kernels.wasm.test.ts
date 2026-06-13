import { describe, expect, test } from "bun:test";
import { TsKernels, WasmKernels } from "../src/kernels/index.ts";

/**
 * End-to-end validation of the WASM glue: load the built joeee-cytometry-wasm
 * artifact, run the kernels, and assert they match the pure-TS kernels (which in
 * turn match the flowutils oracle). Skips gracefully when the .wasm hasn't been
 * built, so `bun test` is green with or without the Rust toolchain.
 *
 * Build it with:  bun run build:wasm
 */
const WASM_PATH =
  "packages/cytometry-wasm/target/wasm32-unknown-unknown/release/joeee_cytometry_wasm.wasm";

const built = await Bun.file(WASM_PATH).exists();
const maybe = built ? test : test.skip;

describe("WASM kernels (vs TS)", () => {
  if (!built) {
    test.skip("wasm artifact not built — run `bun run build:wasm`", () => {});
  }

  maybe("logicleScaleInto matches the TS kernel", async () => {
    const bytes = await Bun.file(WASM_PATH).arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const wasm = new WasmKernels(instance);
    const ts = new TsKernels();

    const input = Float32Array.from([
      -1000, -10, 0, 1, 100, 10000, 262144, 50000, 3,
    ]);
    const a = Float32Array.from(input);
    const b = Float32Array.from(input);
    wasm.logicleScaleInto(a, 262144, 0.5, 4.5, 0);
    ts.logicleScaleInto(b, 262144, 0.5, 4.5, 0);
    for (let i = 0; i < a.length; i++) {
      expect(Math.abs(a[i] - b[i])).toBeLessThan(1e-6);
    }
  });

  maybe("polygonMask matches the TS kernel", async () => {
    const bytes = await Bun.file(WASM_PATH).arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const wasm = new WasmKernels(instance);
    const ts = new TsKernels();

    const xs = Float32Array.from([5, -1, 11, 5, 2, 9]);
    const ys = Float32Array.from([5, 5, 5, 8, 2, 9]);
    const polyX = Float64Array.from([0, 10, 10, 0]);
    const polyY = Float64Array.from([0, 0, 10, 10]);
    const w = wasm.polygonMask(xs, ys, polyX, polyY);
    const t = ts.polygonMask(xs, ys, polyX, polyY);
    expect(Array.from(w)).toEqual(Array.from(t));
  });
});
