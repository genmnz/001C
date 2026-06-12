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
│   │   ├── transforms/        logicle · biexponential · asinh · log · linear
│   │   ├── compensation/      spillover inversion (f64) + apply
│   │   ├── gating/            rectangle · range · ellipse · polygon · quadrant · boolean
│   │   ├── stats/             count · MFI/median · percentile · CV · MAD · geomean · freq
│   │   ├── density/           CPU 2D/1D histogram (source of truth for plots)
│   │   ├── matrix.ts          EventMatrix — columnar, SharedArrayBuffer-backed
│   │   └── population.ts      Population — packed bitset (the core primitive)
│   ├── fcs/                  @joeee/fcs              defensive FCS 2.0/3.0/3.1 parser (TS, 0 deps)
│   ├── cytometry-wasm/       joeee-cytometry-wasm    Rust→WASM hot kernels (logicle, gating, compensation)
│   ├── cytometry-gpu/        @joeee/cytometry-gpu    WebGPU renderer + Canvas2D fallback + WGSL
│   └── engine-controller/    @joeee/engine-controller the UI-agnostic boundary (store + worker RPC)
├── app-web/                 thin reference UI (vanilla TS — swap for React/Solid/Svelte)
├── server/                  tiny Bun static server that sets COOP/COEP
└── docs/
    ├── DERISKING.md          confirmations, criticisms, verified facts, pitfalls
    ├── ARCHITECTURE.md       data flow and the decisions behind it
    └── ROADMAP.md            honest milestone sequence (the "1 week" reframed)
```

The dependency arrow only points one way:

```
app-web ─▶ engine-controller ─▶ cytometry-core
   │              │           ╲▶ fcs
   ╰─▶ cytometry-gpu ─────────▶ cytometry-core      (cytometry-wasm mirrors core's hot kernels)
```

Nothing in `cytometry-core` imports a DOM, a canvas, or a framework. The UI never
imports `cytometry-core` or touches an `EventMatrix`. That boundary is the
"agnostic UI" requirement, enforced by module structure rather than convention.

## Quick start

```bash
bun install            # wires the workspace (local workspace deps + @types only)
bun test               # 60 tests: headless engine + parser + controller
bun run typecheck      # tsc --noEmit across the workspace
cd packages/cytometry-wasm && cargo test   # 8 tests: Rust kernels mirror the TS

# Reference app (needs Vite, which you add when you have network):
#   cd app-web && bunx vite           # dev, with COOP/COEP headers
#   bunx vite build && cd .. && JOEEE_ROOT=app-web/dist bun run server/serve.ts
```

## Status

- **Tested headlessly (CI-safe):** 50 TS tests across core, fcs, and
  engine-controller; 8 Rust tests. Covers the logicle keystone (round-trip,
  monotonicity, analytic anchors), compensation, every gate type, stats, density
  binning, the FCS integer bit-mask / endianness / offset-reconciliation gotchas,
  and the full load → density → gate → stats pipeline.
- **Browser-only (real, not in CI):** WebGPU scatter + GPU 2D-histogram density,
  Canvas2D fallback, the Worker host, the reference app.
- **Deferred by design:** UMAP / t-SNE / PCA / FlowSOM / PhenoGraph / Leiden /
  k-means / HDBSCAN; FlowJo `.wsp` import; DuckDB-WASM. See docs/ROADMAP.md.

## Read next

`docs/DERISKING.md` is the opinionated review of the plan that produced this
scaffold — what holds up, what to rethink, and the pitfalls to wire up on day one
(cross-origin isolation, the wasm32 4 GB ceiling, the logicle patent).
