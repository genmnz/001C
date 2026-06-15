# joeee

A browser-native, **headless-engine-first** flow cytometry workstation — an
open-source FlowJo / Cytobank / OMIQ / CytoExploreR / Spectre / CATALYST /
CytoFlow hybrid that runs with no backend (or a tiny static server). It renders
and gates millions of events interactively and does real statistics on them.

The defining constraint isn't the framework — it's that you render 1–10M events
interactively and run real statistics on every gate drag. So every decision flows
from **GPU for pixels, WASM/TS for math, columnar for data**, and one hard rule:
**the event data never enters UI/framework state.**

---

## Quick start

```bash
bun i                 # install everything (workspace deps + dev @types + app deps)
bun run web           # run the React UI (Vite dev server, cross-origin isolated)
bun test              # run the test suite (engine + parser + controller)
bun run both          # web + test-watch together
```

Other scripts:

| Script | What |
|---|---|
| `bun run typecheck` | `tsc --noEmit` across the workspace |
| `bun run build:web` | build the UI → `app-react/dist` |
| `bun run build:wasm` | build the Rust SIMD kernels → wasm32 (optional; auto-falls back to TS) |
| `bun run test:wasm` | Rust kernel tests + the flowutils golden CSV |
| `bun run golden` | regenerate flowutils-oracle golden values (needs the Python venv) |
| `bun run serve` | tiny Bun static server that sets COOP/COEP (serves `app-react/dist`) |

`bun run web` opens the **projects hub** → "New analysis" loads a demo sample (or
drop/open an `.fcs` file) into the **analysis workspace**.

---

## The app (`app-react`)

The initial agnostic-UI wiring over the controller — **the UI never imports the
engine core**, only `@joeee/engine-controller`.

- **Pages:** projects hub (with `.fcs` drag-drop / file-open) → analysis workspace.
- **Menu bar:** File · Edit · View · Analysis · Transform · Help, dropdowns wired
  to operations (open/export/import, undo/redo, compensate, cluster, embed,
  heatmap, stats, transform).
- **Operations sidebar:** Data · Compensation · Transform · Gating · Clustering ·
  Dim-reduction · Statistics · History — every button calls a controller op.
- **Workspace tabs:**
  - **Density** — real WebGPU/Canvas2D density plot with pan, wheel-zoom-about-cursor,
    rectangle-gate drawing, logicle-aware axis ticks, and X/Y channel selectors.
  - **Embedding** — PCA / UMAP / t-SNE scatter, colored by the last clustering.
  - **Heatmap** — real cluster × marker enrichment (z-scores).
  - **Stats** — per-population statistics table.
- **Inspector:** gate tree + live statistics. **Console:** logs every operation.
- **Export:** workspace JSON + gated CSV download; Gating-ML 2.0 import.

Swap React for Solid/Svelte without touching the engine — the UI binding is one
hook (`useSyncExternalStore(controller.store)`).

---

## Repository

```
joeee/
├── packages/
│   ├── cytometry-core/      @joeee/cytometry-core    headless engine (TS, 0 deps)
│   │   ├── matrix.ts          EventMatrix — columnar, SharedArrayBuffer-backed
│   │   ├── population.ts      Population — packed bitset (the core primitive)
│   │   ├── kernels/           TsKernels ⇄ WasmKernels seam (SIMD when built)
│   │   ├── transforms/        logicle · hyperlog · asinh · log · linear · quantile
│   │   │                       · custom · FlowJo-biex · estimateLogicle (auto-W)
│   │   ├── compensation/      apply (inv(Sᵀ)) · invert · spillover-from-controls
│   │   │                       · spectral OLS/NNLS/WLS + autofluorescence · PMT
│   │   ├── gating/            rectangle · range · ellipse · polygon · quadrant · boolean
│   │   ├── cleaning/          margin · singlet · debris · saturation · time · flowCut
│   │   │                       · isolation-forest QC · drift detection
│   │   ├── stats/             counts · MFI/median · percentile · CV · MAD · geomean
│   │   │                       · fold-change · positivity · co-expression · diversity
│   │   │                       · Mann-Whitney · BH-FDR · violin · absolute · enrichment
│   │   ├── density/           1D/2D histogram · marching-squares contours · hexbin · KDE
│   │   ├── reduce/            PCA · t-SNE · UMAP · MDS
│   │   ├── cluster/           k-means(+Rust) · DBSCAN · FlowSOM · GMM · PhenoGraph
│   │   │                       · hierarchical · consensus · labels→populations
│   │   ├── graph/             kNN · Louvain (modularity)
│   │   ├── autogate/          Otsu · density-valley · quantile · tail thresholds
│   │   ├── diff/              cluster-abundance + rank-based differential abundance
│   │   ├── normalize/         CytoNorm (per-cluster quantile normalization)
│   │   ├── cytof/             debarcoding · bead-norm · isotope spillover (NNLS)
│   │   ├── ml/                logistic regression (IRLS) + accuracy
│   │   ├── spatial/           neighborhood enrichment (kNN co-occurrence)
│   │   ├── discovery/         marker enrichment + top-marker cell typing
│   │   ├── multisample/       sample similarity · population matching · tracking
│   │   └── sample/            concatenate · downsample · CSV export
│   ├── fcs/                  @joeee/fcs               defensive FCS 2.0/3.0/3.1 read + write
│   ├── cytometry-wasm/       joeee-cytometry-wasm     Rust→WASM kernels (logicle, poly, compensate, k-means)
│   ├── cytometry-gpu/        @joeee/cytometry-gpu     WebGPU + Canvas2D renderer, WGSL, axis ticks, pan/zoom
│   └── engine-controller/    @joeee/engine-controller the UI-agnostic boundary (store, worker RPC, workspace, Gating-ML import)
├── app-react/               Bun + Vite + React UI (pages, menus, operations, mock viz)
├── app-web/                 thin vanilla-TS reference UI + WebGPU smoke test
├── server/                  tiny Bun static server (COOP/COEP)
├── scripts/                 dev.ts (web+tests) · golden/ (flowutils oracle generator)
└── docs/                    see "Documentation" below
```

The dependency arrow points one way only:

```
app-react / app-web ─▶ engine-controller ─▶ cytometry-core
        │                     │           ╲▶ fcs
        ╰─▶ cytometry-gpu ────────────────▶ cytometry-core   (cytometry-wasm mirrors core's hot kernels)
```

Nothing in `cytometry-core` imports a DOM, a canvas, or a framework; the UI never
imports `cytometry-core` or touches an `EventMatrix`. That boundary is the
"agnostic UI" requirement, enforced by module structure.

---

## Feature coverage

The full operation catalog and its status live in **`docs/ENGINE.md`** (headless
engine §0–§8 + wiring) and **`docs/ADVANCED.md`** (advanced tiers A–N:
auto-gating, dimensionality reduction, clustering, discovery, differential
analysis, batch correction, ML, spatial, CyTOF, spectral, multi-sample,
workspace, collaboration, enterprise).

The deterministic engine (FCS I/O → cleaning/QC → compensation → transforms →
manual gating → populations → stats → density) is complete and oracle-validated.
The advanced tier covers PCA/t-SNE/UMAP/MDS, k-means/DBSCAN/FlowSOM/GMM/
PhenoGraph/hierarchical/consensus, differential abundance, CytoNorm, CyTOF
debarcoding/bead-norm/isotope-spillover, spectral unmixing, logistic ML, spatial
neighborhoods, Gating-ML 2.0 import, and workspace save/load + undo/redo.

**Still open** (heaviest tier): HDBSCAN/spectral clustering, PHATE/EmbedSOM/Isomap,
edgeR-NB-GLM/GLMM/survival, RandomForest/SVM/NN, FlowJo `.wsp` import, the WASM
zero-copy path + on-device GPU parity, and the explicitly-last collaboration /
enterprise tiers.

---

## Validation & tests

- **~590 TS tests + Rust tests; `tsc` clean; the app builds.**
- Every numeric kernel with an oracle is validated against **flowutils** (the
  FlowKit logicle C extension / Moore–Parks reference): logicle ~5e-17, hyperlog
  ~3e-17, compensation (`solve(Sᵀ,·)`), polygon/ellipse gating (0 mismatches over
  ~18k random points). Stochastic methods (t-SNE/UMAP/FlowSOM/PhenoGraph) are
  validated by neighbor-preservation / purity / modularity, never exact coords.
- Heavy property/fuzz suites: transforms over random params; bitset De Morgan
  laws at 1M bits; stats vs naive; density conservation at 500k events; a 4-level
  gate hierarchy at 100k events; TS⇄WASM kernel parity; GPU-bin == CPU-histogram.
- See **`docs/VALIDATION.md`** for the oracle strategy and **`docs/LICENSES.md`**
  for the per-feature port/clean-room ledger (and the Stanford logicle-patent
  NOTICE).

---

## Documentation

| Doc | Contents |
|---|---|
| `docs/ENGINE.md` | headless engine catalog (§0–§8 + WASM/GPU wiring), status-tracked |
| `docs/ADVANCED.md` | advanced tiers A–N, status-tracked |
| `docs/ARCHITECTURE.md` | layers, data flow, and the decisions behind them |
| `docs/DEVELOPMENT.md` | DX: scripts, the WASM seam, COOP/COEP, adding a UI |
| `docs/VALIDATION.md` | the external-oracle (flowutils) validation strategy |
| `docs/PLOTS.md` | the rendering stack + catalog of plot types and view modes |
| `docs/LICENSES.md` | per-feature license ledger; what to port vs clean-room |
| `docs/DERISKING.md` | the opinionated plan review: what holds up, what to rethink, day-one pitfalls |
| `docs/ROADMAP.md` | milestone sequence with honest units |
| `packages/cytometry-wasm/README.md` | building/calling the Rust→WASM kernels |

New here? Read `docs/ARCHITECTURE.md` for the shape, then `docs/DERISKING.md` for
the why (cross-origin isolation, the wasm32 4 GB ceiling, the logicle patent).
