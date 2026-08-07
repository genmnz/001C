# joeee: Docs Index

**joeee** is a browser-native, headless-engine-first flow / mass / spectral cytometry
workstation. Load FCS → clean → compensate → transform → gate → populations → statistics →
plots, entirely in the browser, with no backend and nothing uploaded.

> **Where to look first.** For **what the engine can do today**, read
> [`ENGINE.md`](./ENGINE.md) (tiers §0 to §8) and [`ADVANCED.md`](./ADVANCED.md) (tiers A to
> N): they are status-tracked and are the source of truth for capability. For the **shape of
> the system**, [`ARCHITECTURE.md`](./ARCHITECTURE.md). For **open work**,
> [`TODO.md`](./TODO.md). For **science gaps that must never be faked**,
> [`RESEARCH.md`](./RESEARCH.md). Repo-wide agent rules: [`../CLAUDE.md`](../CLAUDE.md) =
> [`../AGENTS.md`](../AGENTS.md).

## The owning docs

Each doc **owns** an area. Work in that area starts by reading its doc and ends by updating
it (`CLAUDE.md` §9). Never spawn a new top-level doc; extend the owning one.

| Doc | What it owns |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The layers, the data flow, and **the boundary rules**: event data never in UI state, the one-way dependency arrow, the agnostic-UI seam. The rules in `CLAUDE.md` §3 point here for the why. |
| [ENGINE.md](./ENGINE.md) | The headless engine catalog, §0 substrate through §8 density, plus WASM and WebGPU wiring. Status-tracked `[x]` / `[~]` / `[ ]`. |
| [ADVANCED.md](./ADVANCED.md) | The advanced tiers A to N: auto-gating, dimensionality reduction, clustering, discovery, differential analysis, batch correction, ML, spatial, CyTOF, spectral, multi-sample, workspace, collaboration, enterprise. **The source of truth for A to N.** |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Day-to-day wiring: toolchain, scripts, the TS/WASM kernel seam, cross-origin isolation, how to add a transform / gate / plot / UI, the testing strategy. |
| [VALIDATION.md](./VALIDATION.md) | The external-oracle strategy. Owns `scripts/golden/` and `packages/cytometry-core/test/golden/`: what is validated, to what tolerance, and how to regenerate. |
| [LICENSES.md](./LICENSES.md) | **The per-feature license ledger and the clean-room queue.** A new algorithm module is not merged without a row here (`CLAUDE.md` §2.6). |
| [PLOTS.md](./PLOTS.md) | The rendering stack, the plot-type catalog, and the workspace view modes. Records what was deliberately **not** used (deck.gl, regl, Plotly, Chart.js) and why. |
| [DERISKING.md](./DERISKING.md) | The hard constraints and the reasoning behind them: the wasm32 4 GB ceiling, cross-origin isolation, WebGPU coverage, the logicle patent. Read this before proposing an architecture change. |
| [ROADMAP.md](./ROADMAP.md) | The milestone sequence and the honest gap sweep. Defers to `ADVANCED.md` for A to N status. |
| [CROSS_REPO_LIBRARY_CATALOG.md](./CROSS_REPO_LIBRARY_CATALOG.md) | Cross-repo decision doc: where each operation should run (TS / WASM / FFI / WebGPU) across the sibling repos. |
| [`../packages/cytometry-wasm/README.md`](../packages/cytometry-wasm/README.md) | Building and calling the Rust→WASM kernels. |
| [`../app-react/README.md`](../app-react/README.md) | The React shell over the controller. |

## The four registers

Four jobs, and **none of them is the source of truth for the others**.

| Register | Job |
|---|---|
| [RESEARCH.md](./RESEARCH.md) | **What must never be invented.** Every `TODO:RESEARCH` / `@@@research` marker, with its authority and its oracle. An index, not the source of truth: each item lives in its owning doc or code file. |
| [SOURCES.md](./SOURCES.md) | **What was read**, including what was rejected and why. One row per URL a sweep actually opened. |
| [CHANGELOG.md](./CHANGELOG.md) | **What started and what landed.** Dated, newest first. Not a line per edit. |
| [TODO.md](./TODO.md) | **What is open.** The global backlog, with status marks and enough context to pick an item up cold. |

## Verified facts about this repo

Numbers go stale, so they live in exactly one place: here. Everything else points at the
command instead of restating a number.

| Fact | Value | How to check |
|---|---|---|
| Test suite | **621 pass · 3 skip · 624 tests across 60 files · 69,042 assertions** (2026-08-07) | `bun test` |
| The 3 skips | `kernels.wasm.test.ts`, which skips when the `.wasm` artifact is absent | `bun run build:wasm` then `bun test` makes them run |
| Typecheck | `tsc --noEmit` over the workspace **and** `app-react` | `bun run typecheck` |
| Rust | native kernel tests plus the flowutils golden CSV | `bun run test:wasm` |
| Lint / format | **none exists in this repo.** No Biome, no ESLint, no Prettier. | Do not claim a lint gate ran (`CLAUDE.md` §5) |

## The doc rule

**All documentation lives under a `docs/` dir** (`CLAUDE.md` §9). The only `.md` outside one
are `README.md` files co-located with code, and the root `CLAUDE.md` / `AGENTS.md`. Docs
cross-link each other **and the real code files**: open the owning doc, follow its links,
edit, keep it true.

**Write it in the doc, not the changelog** and **document the negative**: what you did not do
and why, which gate you did not run, which design you rejected and what made it lose. A
decision you can see in the diff explains itself; a decision to *not* do something is
invisible the moment the session ends.

## The doctrine

1. **The event data never enters UI/framework state.** Every architectural decision follows
   from this.
2. **The engine is headless and the UI is swappable.** `cytometry-core` imports no DOM, no
   canvas, no framework, and no runtime dependency. `app-web` exists to prove the claim.
3. **Nothing scientific is invented.** Every numeric kernel with an oracle is validated
   against one; everything without an oracle is registered as a gap, never approximated
   quietly.
4. **Copyleft is clean-roomed, never pasted**, and every algorithm's provenance is recorded
   before it merges.
5. **No backend.** It runs from a static server that sets two headers.
