# joeee — master roadmap

> **Read the status marks here with care.** This doc owns the *build sequence and the gap
> sweep*, not capability status: [`ENGINE.md`](./ENGINE.md) and [`ADVANCED.md`](./ADVANCED.md)
> are the source of truth for what exists, and **Phase E's fine-grained checkboxes below are
> known to lag the code** (the section immediately after this one says so). The open backlog
> is [`TODO.md`](./TODO.md); the science gaps, with their authorities and oracles, are
> [`RESEARCH.md`](./RESEARCH.md). Reconciling or retiring the stale Phase E checkboxes is
> itself a tracked item (`TODO.md` §6).

The full feature surface of the "ultimate open-source FlowJo + Cytobank + Omiq +
CytoExploreR + Spectre + CATALYST + CytoFlow hybrid", ordered by the build
sequence we agreed:

> **Engine first** (headless, hybrid TS + Rust/WASM, every feature swappable by
> OSS-ported logic) → **WebGPU/rendering** → **visualization** → **UI** →
> **collaboration** → **enterprise/fancy**. Most important + hardest first;
> implemented and tested before moving on.

**Legend:** `[x]` done & tested · `[~]` partial · `[ ]` todo.
Engine tags: **(port: <oss>)** = port/borrow the algorithm from that OSS C/R
reference; **TS** / **RS** = language of record (RS = Rust→WASM hot loop, validated
to match a TS or oracle reference). Every engine op is an isolated module behind
an interface, so a port can replace a hand-built version (or vice-versa) without
touching call sites.

OSS references: flowCore, flowUtils, flowWorkspace, openCyto, CytoML, CATALYST,
CytoExploreR, CytoFlow, FlowSOM, Spectre.

---

## Status reconciliation (July 2026)

**Phase E's fine-grained checkboxes below lag the code.** A code audit found the
headless engine is essentially feature-complete across E1–E14/E16; the advanced
tiers are tracked (accurately) in [ADVANCED.md](ADVANCED.md), which is the source
of truth for A–N. Boxes flipped in this pass are verified against the code; the
remaining genuine gaps are consolidated in the sweep below so they aren't buried.

### Web-sourced gap sweep (essentials → fancy)

Cross-checked against FlowJo, OMIQ/Cytobank, and 2025–26 spectral/high-dimensional
literature. **Essentials are done**; what's left is the fancy tier.

**Shipped this pass** (see ADVANCED.md for module links):
- ✅ **Leiden** clustering (connected-community guarantee) + wired as a PhenoGraph
  `community: "leiden"` option — `graph/leiden.ts`.
- ✅ **Spectral clustering** (self-tuning affinity → normalized Laplacian →
  k-means; separates non-convex populations) — `cluster/spectral.ts`.
- ✅ **Isomap** DR (kNN geodesic → classical MDS; unrolls curved manifolds) —
  `reduce/isomap.ts`.
- ✅ **Proliferation / CFSE modeling** (KDE peak-ladder → generations +
  division/proliferation/expansion/replication indices) — `proliferation/`.
- ✅ **Density-dependent downsampling** (SPADE-style) — `sample.densityDependentDownsample`.

**Still genuinely missing (prioritized):**
1. **Clustering** — HDBSCAN; full SPADE tree (density-downsample → cluster → MST). *(ADVANCED §C)*
2. **Trajectory / pseudotime** inference (OMIQ ships it; a 2025–26 standard) —
   *no module yet.*
3. **DR breadth** — opt-SNE (auto-perplexity/KL early-exit), PaCMAP, PHATE,
   TriMap, EmbedSOM, diffusion maps. *(ADVANCED §B)*
4. **Gate shapes** — curly-quad, spider, pencil gates; **HyperFinder**-style
   gate-sequence discovery to recapitulate cluster/DR-defined populations as a
   sortable gating path. *No module yet.*
5. **Spectral signature library / QC / residuals** (unmixing already ships
   OLS/WLS/NNLS/Poisson). *(ADVANCED §J)*
6. **FCS multi-dataset** (`$NEXTDATA`) + streaming/lazy-load parse.

### Performance (this pass + levers)
- ✅ **kNN k-selection** — replaced the per-point O(N log N) full sort + N-length
  allocation with a bounded insertion (O(N·k), zero per-row alloc). Speeds up
  PhenoGraph / UMAP / spatial neighborhood. `graph/knn.ts`.
- **Biggest remaining levers** (documented in DERISKING.md): wire `WasmKernels`
  (logicle → poly → compensation-apply → percentile) via `build:wasm`; GPU
  `max`-bin reduction to drop the CPU round-trip; approximate NN (kd-tree/HNSW)
  to break the O(N²) brute force in `knn`/`kde`; quickselect for the per-gate
  percentile/MAD sort in `stats/descriptive.ts`.

---

## Phase E — Engine (headless) — **IN PROGRESS**

### E1 · FCS I/O  (port: flowCore/flowIO)
- [x] Read FCS 2.0/3.0/3.1 (`@joeee/fcs`, TS)
- [x] Parse metadata / channels / markers / `$SPILLOVER` (TS)
- [x] Integer bit-mask vs `$PnR`, `$BYTEORD`, HEADER/TEXT offset reconciliation (TS)
- [x] Validate FCS integrity (warnings + `compensation/validate.ts` spillover checks)
- [x] Write FCS (TS) — round-trips our parser (`fcs/src/write.ts`)
- [ ] Stream / lazy-load FCS (TS, parse into a SAB chunk-by-chunk)
- [x] Parse acquisition / instrument settings (metadata via `fcs/src/parse.ts`)
- [~] Concatenate FCS done (`sample.concatenate`); first-class merge/split todo
- [x] Downsample events — reservoir + systematic + **density-dependent (SPADE)** (`sample`)
- [x] Export gated / transformed populations — CSV (`sample.exportCsv`) + FCS write
- [ ] Convert FCS versions (TS)
- [~] ASCII (`$DATATYPE A`) done (delimited + fixed-width, `@joeee/fcs`); multi-dataset (`$NEXTDATA`) (TS) still todo

### E2 · Data cleaning / QC  (port: openCyto, PeacoQC, flowAI)
- [x] Range/threshold cleaning via gates (`gating`, TS)
- [x] Doublet removal (`cleaning.SingletGate`, area/height ratio)
- [x] Debris removal (`cleaning.debrisGate`, low FSC/SSC)
- [x] Saturated / edge event removal (`cleaning.saturationMask` / `marginMask`)
- [x] Acquisition-time filtering (`cleaning.timeWindowMask`; `flowCutQC` unstable-period)
- [~] Dead-cell removal — via viability-channel gate (no dedicated helper yet)
- [x] Outlier / anomaly detection (`cleaning.isolationForest`)
- [x] QC scoring; instrument-drift detection (`cleaning.flowCutQC` / `detectDrift`)

### E3 · Compensation & spectral  (port: flowCore, CATALYST, AutoSpill)
- [x] Apply compensation `inv(Sᵀ)·obs` (oracle-validated) (`compensation`, TS)
- [x] Matrix inversion f64 (TS + **RS** mirror)
- [x] Calculate spillover from single-stain controls (`compensation.spilloverFromControls`)
- [~] Validate spillover matrix done (`compensation/validate.ts`); editing UI (TS) still todo
- [ ] Auto-compensation (AutoSpill-style least-squares) (TS→RS)
- [x] Spectral unmixing OLS/WLS/NNLS/Poisson (`compensation/unmix.ts`)
- [x] Autofluorescence extraction / subtraction (per-cell AF column in `unmix`)
- [x] Detector / PMT normalization (`compensation/pmt.ts`)

### E4 · Transformations  (port: flowUtils/flowCore, Moore–Parks)
- [x] Logicle (oracle-validated ~5e-17, TS + **RS**)
- [x] Hyperlog (oracle-validated ~3e-17, TS)
- [x] Arcsinh (+ cofactor), Log, Linear (TS)
- [x] Inverse transforms (`unscale`) + channel-specific application (TS)
- [x] Biexponential — FlowJo parameterization (`transforms/biexponential.ts`)
- [x] Quantile transform (`transforms/quantile.ts`)
- [x] Custom / user-defined transform (`transforms/custom.ts`)
- [x] Transform parameter optimization — auto-W from data (`transforms/estimateLogicle.ts`)

### E5 · Manual gating  (port: flowCore/flowWorkspace, GatingML 2.0)
- [x] Rectangle, Range, Ellipse, Polygon, Quadrant (oracle-validated) (TS + **RS** poly)
- [x] Boolean (AND/OR/NOT/XOR/diff) as bitset ops (TS)
- [x] Population hierarchy / parent–child restriction (TS, controller)
- [x] Gate templates (save/apply geometry across samples) (`engine-controller` templates)
- [~] Gate copy / paste / sync across plots (templates cover apply-across; live sync TODO)
- [ ] Gate versioning (TS, with workspace history)

### E6 · Automated gating  (port: openCyto, flowDensity, flowClust)
- [x] 1D auto-threshold — Otsu (`autogate`)
- [x] 1D density-valley / `mindensity` (KDE local minima) (`autogate`)
- [~] Peak-detection gating (KDE peaks available; dedicated gate op TODO)
- [x] Quantile / tail gating (`autogate`)
- [x] Singlet gate (FSC-A vs FSC-H) (`cleaning.SingletGate`)
- [ ] flowDensity-style 2D auto-gating (TS)
- [~] Mixture-model / Gaussian gating — GMM backbone (`cluster/gmm`); 2D-gate wiring TODO
- [ ] Rule-based / template-driven hierarchical gating (openCyto csv templates) (TS)
- [ ] Cluster-derived gating; reference gating; batch gating (TS)
- [ ] Neural / AI-assisted gating (defer to ML phase)

### E7 · Population management
- [x] Population tree; union/intersection/subtraction (boolean) (TS)
- [~] Rename / annotate / label (controller node fields)
- [ ] Merge / split populations as first-class ops (TS) ← next
- [x] Population matching across samples (`multisample.match`, nearest-centroid)
- [x] Population tracking (longitudinal) (`multisample.track`)

### E8 · Statistics  (port: flowCore, CytoExploreR)
- [x] Counts, % parent, % total, mean, median (MFI), geomean, CV, MAD, percentile, min/max, stdev (TS)
- [x] Fold change (`stats.foldChange` / `log2FoldChange`)
- [x] Marker positivity (`stats.markerPositivity`)
- [x] Marker co-expression (`stats.coExpression`)
- [x] Diversity scores (`stats.shannonDiversity` / `simpsonDiversity`)
- [x] Absolute counts (bead/volume) (`stats.absoluteConcentration`)
- [x] Enrichment scores (`stats.enrichmentScore`)

### E9 · Dimensionality reduction  (port: scikit/Rtsne/uwot/PHATE)
- [x] PCA (Jacobi eigen, exact) (`reduce/pca`)
- [x] MDS / classical (Torgerson) (`reduce/mds`)
- [x] t-SNE (exact, perplexity-calibrated) (`reduce/tsne`)
- [x] UMAP (fuzzy simplicial set + SGD) (`reduce/umap`)
- [x] Isomap (geodesic kNN → classical MDS) (`reduce/isomap`)
- [ ] opt-SNE / PaCMAP / TriMap / PHATE / Diffusion Maps / EmbedSOM / ICA / NMF (fancy)
- [ ] Autoencoders / VAE (defer; onnxruntime-web)

### E10 · Clustering  (port: FlowSOM, PhenoGraph, scikit)
- [x] K-means (++ seeded; **RS** assign kernel) (`cluster/kmeans`)
- [x] FlowSOM (SOM + MST + k-means metacluster) (`cluster/flowsom`)
- [x] PhenoGraph (kNN → Jaccard → Louvain) (`cluster/phenograph`)
- [x] DBSCAN, GMM, hierarchical, consensus, **spectral** (`cluster/*`)
- [x] Leiden (connected-community guarantee) (`graph/leiden`); PhenoGraph `community` option
- [ ] HDBSCAN; full SPADE tree (fancy — see gap sweep)

### E11 · Batch effects / normalization  (port: CytoNorm, CATALYST)
- [x] CytoNorm — per-cluster quantile alignment (`normalize/cytonorm`)
- [ ] Reference / control-based normalization; drift correction (TS)

### E12 · Differential analysis  (port: diffcyt, CATALYST)
- [x] Differential abundance (per-sample freq + Mann-Whitney; diffcyt-style rank + BH-FDR) (`diff`, `stats`)
- [ ] Differential expression / marker intensity (TS)
- [ ] Between-group / longitudinal / responder analysis (TS)

### E13 · Multi-sample
- [ ] Sample groups / cohort metadata model (TS)
- [x] Population frequency matrices; sample similarity (`multisample`, `diff`); consensus pops TODO

### E14 · Workspace serialization & history  (port: flowWorkspace, CytoML)
- [x] Workspace document schema → JSON; save / load (`engine-controller/workspace`)
- [x] Undo / redo (view-state history) (`engine-controller`)
- [x] Gating-ML 2.0 import (`engine-controller/interop`)
- [ ] FlowJo `.wsp` import (CytoML); Cytobank import; audit trail
- [ ] Reproducibility manifest (params + versions) (TS)

### E15 · Machine learning  (onnxruntime-web / linfa-RS)
- [x] Logistic regression (IRLS) + accuracy (`ml/logistic`)
- [ ] RF / XGBoost / SVM / NN; feature importance / SHAP

### E16 · Modality specifics
- [x] CyTOF: bead normalization (Finck), debarcoding, isotope spillover (NNLS) (`cytof/*`)
- [x] Spectral flow: OLS/WLS/NNLS/Poisson unmixing + per-cell AF (`compensation/unmix`)
- [ ] Spectral: signature library / QC / residuals (fancy)
- [x] Spatial: neighborhood enrichment (`spatial`); cell–cell interaction / spatial clustering TODO

---

## Phase G — WebGPU / rendering
- [x] WebGPU device + feature detection; Canvas2D fallback (TS)
- [x] GPU 2D-histogram density (compute→render shared buffer); colormap CPU+WGSL (WGSL)
- [x] GPU bin formula validated identical to CPU histogram (TS)
- [x] Pan / wheel-zoom-about-cursor (pure, fuzz-tested) (TS)
- [ ] On-device device boot + 1M-point render from SAB (manual smoke page exists)
- [ ] GPU `max`-bin reduction pass (remove the CPU max round-trip)
- [ ] Instanced scatter wired to real data + GPU picking/hover
- [ ] LOD downsampling for zoomed-out views
- [ ] WebGL2 fallback backend (only if telemetry shows non-WebGPU traffic)

## Phase V — Visualization (plot types; see docs/PLOTS.md)
- [x] Density / pseudocolor scatter (engine bins → renderer)
- [~] Histogram (1D), gate overlay, quadrant (data path exists; UI partial)
- [ ] Contour (d3-contour over bins), hexbin, backgated scatter
- [ ] Heatmaps (marker/cluster/correlation), violin/box/swarm/ridge
- [ ] Embedding scatter (t-SNE/UMAP colored by cluster/marker)
- [ ] Volcano, bar/pie, parallel-coords, Sankey, treemap

## Phase U — UI / app
- [x] Agnostic controller + observable store (TS)
- [x] React shell: pan/zoom, rect-gate draw, gate tree, stats, compensate (TS)
- [ ] Polygon draw (click vertices) + draggable vertex handles (`movePolygonVertex` exists)
- [ ] Workspace modes (Gating/QC/Exploration/Clustering/Stats/Figure/Report)
- [ ] Dockable panels, command palette, keyboard shortcuts
- [ ] Metadata editor, panel/marker manager, pipeline builder

## Phase C — Collaboration
- [ ] Shared projects, comments, annotations
- [ ] Review/approval workflows, version control, permissions, publishing
- [ ] Real-time co-editing (CRDT over the workspace document)

## Phase X — Enterprise / fancy
- [ ] Billions of cells (out-of-core / chunked), distributed compute
- [ ] Cloud execution, scheduled analysis, workflow pipelines, API access
- [ ] LLM assistant (explain gates/clusters, suggest gating, write methods)

---

## Working notes
- **Validation:** every ported algorithm gets an external-oracle test where one
  exists (flowUtils/FlowKit/scikit golden values), else a property/fuzz test +
  an independent in-repo reference. See `docs/VALIDATION.md`.
- **Hybrid rule:** build in TS first (correct + tested); promote a hot loop to
  Rust→WASM (`packages/cytometry-wasm`) when profiling demands it, validated to
  match the TS bit-for-bit. The kernel seam (`Kernels`) makes the swap invisible
  to callers.
- **Swappable rule:** each feature is a module behind a small interface; "port
  from OSS" and "hand-built" are interchangeable implementations of that
  interface.
