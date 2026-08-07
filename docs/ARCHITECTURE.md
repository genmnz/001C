# Architecture

**Owning doc for the boundary rules.** [`CLAUDE.md`](../CLAUDE.md) §3 states them as
enforceable rules and points here for the reasoning. If the two ever disagree, they are both
wrong until someone reconciles them.

joeee is **headless-engine-first with an agnostic UI**. The engine is a set of
pure, framework-free, DOM-free TypeScript packages (with a few hot loops mirrored
in Rust→WASM). The UI is a thin shell that talks to one object — the
`EngineController` — and renders from its observable store. Swapping React for
Solid for Svelte for nothing touches zero engine code.

## The one rule everything serves

> The event data never enters UI/framework state.

A million-row table in React/Solid/Svelte reactive state kills interactivity.
So: `EventMatrix` and `Population` bitsets live in the engine (and, in the
browser, in a Web Worker behind a `SharedArrayBuffer`). Only *view state* —
sample/channel metadata, gate geometry, axis selections, computed numbers — lives
in the store the UI subscribes to. Even derived render payloads (density bins) are
*returned to the renderer*, not stored.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│ app-react  (the product UI)  ·  app-web  (vanilla-TS proof)   │
│   • issues commands to the controller                         │
│   • subscribes to controller.store, re-renders                │
│   • owns the <canvas> and hands bins to the renderer          │
└───────────────┬───────────────────────────┬──────────────────┘
                │ commands / store            │ bins, frames
                ▼                             ▼
┌───────────────────────────────┐   ┌────────────────────────────┐
│ @joeee/engine-controller      │   │ @joeee/cytometry-gpu        │
│   Store (observable, agnostic)│   │   Renderer interface        │
│   EngineController (commands) │   │   WebGPU scatter + density  │
│   EngineApi backend ──────────┼─┐ │   Canvas2D fallback         │
└───────────────────────────────┘ │ │   colormap / densityToImage │
                                   │ └─────────────┬──────────────┘
            in-process │ or Worker │               │ (pure parts shared)
                       ▼           ▼               ▼
        ┌──────────────────────────────────────────────────────┐
        │ @joeee/cytometry-core   (headless engine, 0 deps)     │
        │   EventMatrix · Population · transforms · compensation │
        │   gating · stats · density(histogram = source of truth)│
        │ @joeee/fcs              (defensive parser, 0 deps)     │
        └──────────────────────────────────────────────────────┘
                       ▲
                       │ hot kernels mirrored (raw C ABI over linear memory)
        ┌──────────────────────────────────────────────────────┐
        │ joeee-cytometry-wasm   (Rust→WASM: logicle, gating,   │
        │                         compensation; SIMD)            │
        └──────────────────────────────────────────────────────┘
```

## Data flow: load → render → gate → stats

1. **Load.** `@joeee/fcs` parses bytes → column-major Float32 (exactly
   `EventMatrix`'s layout) + channel metadata + spillover. The engine wraps it in
   an `EventMatrix` (SAB-backed when cross-origin isolated).
2. **Transform.** The engine applies a scale (logicle/asinh/…) to produce a
   *display column*, cached per (sample, channel, transform). Gating and binning
   both consume display columns.
3. **Render.** The controller asks the engine for a 2D histogram over the current
   viewport; the renderer colormaps it. The GPU path bins on-device (compute pass)
   and colormaps from the same `STORAGE` buffer; the CPU path uses
   `cytometry-core/density` + `densityToImage`. Both must agree.
4. **Gate.** A `GateSpec` (serializable) → the engine builds the core gate, runs
   point-in-polygon (etc.) over the parent population's set bits, and stores the
   resulting `Population` bitset. Only the count + geometry go back to the store.
5. **Stats.** Reductions over the population's set bits (count, median/MFI,
   percentile, CV, MAD, geomean, frequency-of-parent/total) → numbers into the
   store.

On a **gate drag**, only step 4 re-runs over the cached display columns — that's
how the <100 ms target is reachable at millions of events. The hot kernels can be
swapped for the Rust/WASM SIMD versions without changing call sites.

## The agnostic-UI boundary

`@joeee/engine-controller` is the seam:

- **`EngineApi`** — the contract between controller and engine. Two
  implementations: `createInProcessBackend` (tests, SSR, thumbnails) and
  `createWorkerBackend` (the app). The controller is written against the
  interface, so the *same controller* drives either with no code change.
- **`Store<T>`** — a 30-line observable. Framework adapters at the edge:
  - React: `useSyncExternalStore(store.subscribe, store.get)`
  - Solid: a signal fed by `store.subscribe`
  - Svelte: `{ subscribe: store.subscribe }` is already a Svelte store

To add a real UI: depend on `@joeee/engine-controller` (+ `@joeee/cytometry-gpu`
for the canvas), construct a controller with a worker backend, and render from
the store. Do **not** import `@joeee/cytometry-core` from UI code.

**Why there are two apps, and why `app-web` is kept.** `app-react` is the product.
`app-web` is the vanilla-TS reference whose entire job is to *prove* the claim above: it
constructs a controller, issues commands, renders from the store, and never imports
`cytometry-core`. Delete it and the agnosticism claim becomes an assertion nobody checks.
That makes it load-bearing documentation, not dead scaffolding, with one obligation
attached: **a change to the controller surface must update both apps.** Today `app-web` has
no scripts, no tests, and no CI step, so nothing would catch it breaking; that gap is
recorded in [`TODO.md`](./TODO.md) §6.

**The boundary is currently enforced by module structure and review, not by a check.** Both
halves (no `cytometry-core` import from UI code, no DOM or framework import inside
`cytometry-core`) are grep-checkable and belong in CI. Until they are there, the rule holds
only because people hold it.

## Key decisions (and where they live)

| Decision | Where | Rationale |
|---|---|---|
| Columnar, channel-major matrix | `matrix.ts` | every hot op streams 1–2 columns; GPU wants per-attribute arrays |
| `SharedArrayBuffer` backing | `matrix.ts` `allocBuffer` | zero-copy across Worker + GPU; dodges wasm32 4 GB ceiling |
| Population = packed bitset | `population.ts` | boolean gates are word-wise; stats reduce over set bits |
| Gates operate in display space | `gating/*`, engine `displayColumn` | gates are drawn on transformed plots; keeps geometry pure |
| f64 for logicle + inversion | `logicle.ts`, `invert.ts` | root-finding / matrix inverse accumulate visible f32 error |
| Density math in the engine | `density/histogram2d.ts` | source of truth; GPU shader mirrors it; plots stay testable |
| Renderer interface | `renderer.ts` | WebGPU-first, but Canvas2D/WebGL2 is a backend, not a rewrite |
| Raw C ABI for WASM (no bindgen) | `wasm/src/lib.rs` | dependency-free; pass SAB slice pointers; offline `cargo test` |
