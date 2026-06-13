# Development & DX

How the pieces wire together so that, day to day, you build a feature in the
engine and the app picks it up through the controller — "wire it and magic
happens." Read `ARCHITECTURE.md` for the why; this is the how.

## Toolchain

| Tool | Version | For |
|---|---|---|
| Bun | ≥ 1.3 | package manager, test runner, TS execution |
| Rust + cargo | stable | the WASM hot kernels (`packages/cytometry-wasm`) |
| Python 3 (optional) | 3.11 | regenerating logicle golden values (flowutils oracle) |
| Vite (added per app) | latest | dev server + bundling for the UI apps |

```bash
bun install        # workspace symlinks + dev type packages
bun test           # 73 tests: engine, parser, controller, golden, wasm glue
bun run typecheck  # tsc --noEmit across the workspace (clean)
```

## Scripts

| Script | What |
|---|---|
| `bun test` | all TS tests (golden + wasm-glue tests skip gracefully if wasm unbuilt) |
| `bun run test:wasm` | `cargo test` — Rust kernels incl. the flowutils golden CSV |
| `bun run build:wasm` | adds the wasm32 target and builds with `+simd128` |
| `bun run golden` | regenerate logicle golden values (needs the venv, see VALIDATION.md) |
| `bun run typecheck` | `tsc -p tsconfig.base.json --noEmit` |
| `bun run serve` | tiny static server with COOP/COEP (`JOEEE_ROOT=… PORT=…`) |

## The kernel seam (TS ⇄ WASM, transparently)

Hot loops (logicle over a column, point-in-polygon over events) live behind the
`Kernels` interface in `@joeee/cytometry-core`. The `Engine` takes one in its
constructor and defaults to pure TS:

```ts
new Engine();                    // TsKernels — always works, no build step
new Engine(await loadWasmKernels("/joeee_cytometry_wasm.wasm")); // SIMD path
```

`loadWasmKernels` falls back to `TsKernels` if the `.wasm` is missing or fails to
instantiate, so there is never a hard dependency on the build. Both backends are
asserted identical in `kernels.wasm.test.ts` (and the TS one matches the
flowutils oracle), so swapping backends can't change results.

To use the WASM path in the app:

```bash
bun run build:wasm
cp packages/cytometry-wasm/target/wasm32-unknown-unknown/release/*.wasm app-web/public/
```

```ts
// in the worker (so kernels run off the main thread):
import { Engine, loadWasmKernels } from "@joeee/engine-controller"; // re-exports core
const engine = new Engine(await loadWasmKernels("/joeee_cytometry_wasm.wasm"));
```

> Scale note: the staging wrapper copies a column into wasm memory per call. For
> the true zero-copy 10M-event path, back the `EventMatrix` with the module's
> (shared) `WebAssembly.Memory` and pass offsets — see `docs/DERISKING.md`. The
> interface doesn't change; only `WasmKernels`' internals do.

## Cross-origin isolation (required for SAB + threads)

Both must be present, or `SharedArrayBuffer` is unavailable and the matrix falls
back to per-worker copies:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

- **Dev:** the app's `vite.config.ts` sets them on `server` and `preview`.
- **Prod:** `server/serve.ts` sets them (and `Cross-Origin-Resource-Policy`).
- **Check at runtime:** `isCrossOriginIsolated()` from `@joeee/cytometry-gpu`.
- Any cross-origin asset must send CORP or be self-hosted, or COEP blocks it.

## Adding things

- **A transform:** implement `Transform` in `cytometry-core/src/transforms`,
  export it, add a `TransformSpec` variant + a `makeTransform` case in
  `engine-controller/src/factories.ts`. If it's hot, add a kernel method.
- **A gate:** implement `Gate2D`/`Gate1D`, add a `GateSpec` variant + a
  `makeGate*` case. Point-in-polygon-class gates go through `Kernels`.
- **A plot type:** the engine produces the data (bins/stats); the renderer draws
  it. See `docs/PLOTS.md` for the catalog and which primitive feeds each.
- **A framework UI:** depend on `@joeee/engine-controller` (+ `cytometry-gpu`),
  construct an `EngineController`, render from `controller.store`. Never import
  `cytometry-core` from UI code. Adapters:
  - React: `useSyncExternalStore(controller.store.subscribe, controller.store.get)`
  - Solid: a signal driven by `controller.store.subscribe`
  - Svelte: `{ subscribe: controller.store.subscribe }` is a Svelte store

## Testing strategy

- **Headless, in CI:** everything in `cytometry-core`, `fcs`,
  `engine-controller` (incl. the full load→density→gate→stats pipeline), the
  logicle golden tests, and the Rust kernels. `tsc` must stay clean.
- **Conditional:** `kernels.wasm.test.ts` runs only when the `.wasm` is built
  (CI builds it in the `rust` job; the GPU test page is manual — no GPU in CI).
- **Validation gates:** see `docs/VALIDATION.md` (logicle is oracle-validated;
  compensation/gating against external fixtures is the open item).
