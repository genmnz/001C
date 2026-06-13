# joeee

A browser-native, **headless-engine-first** flow cytometry workstation — a
"FlowJo Lite" you can run with no backend (or a tiny static server). Renders and
gates millions of events interactively; does the statistics that matter.

The defining constraint isn't the framework — it's that you render 1–10M events
interactively and run real statistics on them on every gate drag. So every
decision flows from **GPU for pixels, WASM/TS for math, columnar for data**, and
from one hard rule: **the event data never enters UI/framework state.**

## What's here

This repo is a working monorepo scaffold. The headless engine is real and
tested; the rendering and UI layers are real but browser-only (not run in CI).

```
joeee/
├── packages/
│   ├── cytometry-core/      @joeee/cytometry-core   headless engine (TS, 0 deps)
│   │   ├── transforms/        logicle · hyperlog · asinh · log · linear (all oracle-validated)
│   │   ├── compensation/      spillover inversion (f64) + apply
│   │   ├── gating/            rectangle · range · ellipse · polygon · quadrant · boolean
│   │   ├── stats/             count · MFI/median · percentile · CV · MAD · geomean · freq
│   │   ├── density/           CPU 2D/1D histogram (source of truth for plots)
│   │   ├── kernels/           Kernels seam: TsKernels (default) ⇄ WasmKernels (SIMD)
│   │   ├── matrix.ts          EventMatrix — columnar, SharedArrayBuffer-backed
│   │   └── population.ts      Population — packed bitset (the core primitive)
│   ├── fcs/                  @joeee/fcs              defensive FCS 2.0/3.0/3.1 parser (TS, 0 deps)
│   ├── cytometry-wasm/       joeee-cytometry-wasm    Rust→WASM hot kernels (logicle, gating, compensation)
│   ├── cytometry-gpu/        @joeee/cytometry-gpu    WebGPU renderer + Canvas2D fallback + WGSL + axis ticks
│   └── engine-controller/    @joeee/engine-controller the UI-agnostic boundary (store + worker RPC)
├── app-react/               lightweight Bun + Vite + React shell on the controller
├── app-web/                 thin reference UI (vanilla TS — no framework)
├── server/                  tiny Bun static server that sets COOP/COEP
├── scripts/golden/          flowutils oracle generator for logicle golden values
└── docs/
    ├── DERISKING.md          confirmations, criticisms, verified facts, pitfalls
    ├── ARCHITECTURE.md       data flow and the decisions behind it
    ├── VALIDATION.md         the logicle oracle strategy (flowutils) + what's open
    ├── DEVELOPMENT.md        DX: scripts, the WASM seam, COOP/COEP, adding a UI
    ├── PLOTS.md              plot stack + catalog of plot types and view modes
    └── ROADMAP.md            honest milestone sequence (the "1 week" reframed)
```

The dependency arrow only points one way:

```
app-react / app-web ─▶ engine-controller ─▶ cytometry-core
        │                     │           ╲▶ fcs
        ╰─▶ cytometry-gpu ────────────────▶ cytometry-core   (cytometry-wasm mirrors core's hot kernels)
```

Nothing in `cytometry-core` imports a DOM, a canvas, or a framework. The UI never
imports `cytometry-core` or touches an `EventMatrix`. That boundary is the
"agnostic UI" requirement, enforced by module structure rather than convention.

## Quick start

```bash
bun install            # wires the workspace (local workspace deps + dev @types)
bun test               # 80 TS tests: engine, parser, controller, golden, wasm glue
bun run typecheck      # tsc --noEmit across the workspace
bun run build:wasm     # build the Rust SIMD kernels to wasm32 (optional; auto-falls back)
bun run test:wasm      # 9 Rust tests: kernels + flowutils golden CSV

# React shell (deps installed): runnable + builds
cd app-react && bun run dev          # dev with COOP/COEP
cd app-react && bun run build        # -> app-react/dist
```

## Status

- **Tested headlessly (CI-safe):** ~485 TS tests (≈45k assertions) + Rust tests.
  Every core operation is **validated against the flowutils external oracle**:
  logicle (~5e-17) and hyperlog (~3e-17) transforms, compensation
  (`solve(Sᵀ,·)`, transpose bug caught), and polygon/ellipse gating (0 mismatches
  over ~18k points). Plus heavy property/fuzz suites (transforms over random
  params, bitset De Morgan laws at 1M bits, stats vs naive, density conservation
  at 500k events, a 4-level gate hierarchy at 100k events), the FCS gotchas, the
  TS⇄WASM kernel parity, and the GPU bin formula vs the CPU histogram.
- **Runnable:** the React shell builds (Vite, 56 kB gzipped) and the WASM kernels
  build to wasm32 with SIMD.
- **Browser-only (real, not in CI):** WebGPU scatter + GPU 2D-histogram density
  (compute→render buffer sharing; see `app-web/webgpu-smoketest.html`), the
  Worker host.
- **Deferred by design:** UMAP / t-SNE / PCA / FlowSOM / PhenoGraph / Leiden /
  k-means / HDBSCAN; FlowJo `.wsp` import; DuckDB-WASM. See docs/ROADMAP.md.

## Read next

`docs/DERISKING.md` is the opinionated review of the plan that produced this
scaffold — what holds up, what to rethink, and the pitfalls to wire up on day one
(cross-origin isolation, the wasm32 4 GB ceiling, the logicle patent).
