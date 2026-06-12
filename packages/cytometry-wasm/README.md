# joeee-cytometry-wasm

The small Rust surface the de-risking plan recommends **porting** (not the whole
engine): logicle/biexponential, point-in-polygon gating, and spillover
inversion. These mirror `@joeee/cytometry-core` exactly and are validated against
the same anchors/round-trips, so the TS reference and the WASM kernel agree to
~1e-6.

## Why a raw C ABI (no wasm-bindgen)

The kernels operate on columns of the event matrix. That matrix lives in a JS
`SharedArrayBuffer` (never copied into the WASM heap — see `docs/DERISKING.md` on
the wasm32 4 GB ceiling). So the natural interface is: pass a **pointer + length**
into the wasm linear memory and let the kernel work in place. That needs no
bindgen, keeps the crate dependency-free, and lets `cargo test` run offline.

## Test (native, offline)

```bash
cargo test --offline
```

Validates the algorithms on the host — same logicle anchors, point-in-polygon,
and matrix inversion as the TS suite.

## Build the WASM

```bash
rustup target add wasm32-unknown-unknown
RUSTFLAGS="-C target-feature=+simd128" \
  cargo build --release --target wasm32-unknown-unknown
# -> target/wasm32-unknown-unknown/release/joeee_cytometry_wasm.wasm
```

Load it from JS by instantiating the module and calling exports over a typed
array view of the shared buffer:

```ts
const { instance } = await WebAssembly.instantiateStreaming(fetch("/joeee_cytometry_wasm.wasm"));
const { memory, logicle_scale_into } = instance.exports as any;
// Copy/point a column into wasm memory, then:
logicle_scale_into(ptr, len, 262144, 0.5, 4.5, 0); // scales in place
```

For ergonomic glue (memory management, JS wrappers) you can later layer
`wasm-bindgen`/`wasm-pack` on top, but the raw exports are enough for the hot
loops and avoid a bindgen toolchain in CI.

## Exports

| Export | Mirrors | Notes |
|---|---|---|
| `logicle_scale_into(ptr, len, T, W, M, A)` | `LogicleTransform.scale` | f32 column, in place |
| `polygon_mask(xs, ys, n, polyX, polyY, polyN, out)` | `PolygonGate` | writes 0/1 mask |
| `invert_square` (rlib) | `invertSquare` | f64 Gauss-Jordan |
