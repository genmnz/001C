# joeee — master roadmap

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

## Phase E — Engine (headless) — **IN PROGRESS**

### E1 · FCS I/O  (port: flowCore/flowIO)
- [x] Read FCS 2.0/3.0/3.1 (`@joeee/fcs`, TS)
- [x] Parse metadata / channels / markers / `$SPILLOVER` (TS)
- [x] Integer bit-mask vs `$PnR`, `$BYTEORD`, HEADER/TEXT offset reconciliation (TS)
- [~] Validate FCS integrity (collects warnings; no strict mode yet)
- [ ] Write FCS (TS) — round-trip our parser
- [ ] Stream / lazy-load FCS (TS, parse into a SAB chunk-by-chunk)
- [ ] Parse acquisition / instrument settings (TS)
- [ ] Merge / split / concatenate FCS (TS)
- [ ] Downsample / upsample events (TS; reservoir + density-preserving)
- [ ] Export gated / transformed populations to FCS/CSV (TS)
- [ ] Convert FCS versions (TS)
- [ ] ASCII (`$DATATYPE A`) + multi-dataset (`$NEXTDATA`) (TS)

### E2 · Data cleaning / QC  (port: openCyto, PeacoQC, flowAI)
- [x] Range/threshold cleaning via gates (`gating`, TS)
- [ ] Doublet removal (FSC-A/H or SSC-A/H ratio gate) (TS) ← next
- [ ] Debris removal (low FSC/SSC) (TS) ← next
- [ ] Saturated / edge event removal (TS) ← next
- [ ] Acquisition-time filtering / unstable-period removal (flowAI-style) (TS)
- [ ] Dead-cell removal (viability channel) (TS)
- [ ] Outlier / anomaly detection (TS, then RS for kNN)
- [ ] QC scoring; instrument-drift detection (TS)

### E3 · Compensation & spectral  (port: flowCore, CATALYST, AutoSpill)
- [x] Apply compensation `inv(Sᵀ)·obs` (oracle-validated) (`compensation`, TS)
- [x] Matrix inversion f64 (TS + **RS** mirror)
- [ ] Calculate spillover from single-stain controls (TS)
- [ ] Edit / validate spillover matrix (TS)
- [ ] Auto-compensation (AutoSpill-style least-squares) (TS→RS)
- [ ] Spectral unmixing (OLS/WLS/NNLS) (port: CATALYST/flowUtils `compensate_spectral_ols`) (TS→RS)
- [ ] Autofluorescence extraction / subtraction (TS)
- [ ] Detector / PMT normalization (TS)

### E4 · Transformations  (port: flowUtils/flowCore, Moore–Parks)
- [x] Logicle (oracle-validated ~5e-17, TS + **RS**)
- [x] Hyperlog (oracle-validated ~3e-17, TS)
- [x] Arcsinh (+ cofactor), Log, Linear (TS)
- [x] Inverse transforms (`unscale`) + channel-specific application (TS)
- [~] Biexponential (logicle covers it; add FlowJo's distinct parameterization)
- [ ] Quantile transform (TS)
- [ ] Custom / user-defined transform (TS)
- [ ] Transform parameter optimization (auto-W from data) (TS)

### E5 · Manual gating  (port: flowCore/flowWorkspace, GatingML 2.0)
- [x] Rectangle, Range, Ellipse, Polygon, Quadrant (oracle-validated) (TS + **RS** poly)
- [x] Boolean (AND/OR/NOT/XOR/diff) as bitset ops (TS)
- [x] Population hierarchy / parent–child restriction (TS, controller)
- [ ] Gate templates (save/apply geometry across samples) (TS)
- [ ] Gate copy / paste / sync across plots (TS, controller)
- [ ] Gate versioning (TS, with workspace history)

### E6 · Automated gating  (port: openCyto, flowDensity, flowClust)
- [ ] 1D auto-threshold — Otsu (TS) ← next
- [ ] 1D density-valley / `mindensity` (KDE local minima) (TS) ← next
- [ ] Peak-detection gating (TS) ← next
- [ ] Quantile / tail gating (TS) ← next
- [ ] Singlet gate (FSC-A vs FSC-H diagonal) (TS) ← next
- [ ] flowDensity-style 2D auto-gating (TS)
- [ ] Mixture-model / Gaussian gating (flowClust, EM) (TS→RS)
- [ ] Rule-based / template-driven hierarchical gating (openCyto csv templates) (TS)
- [ ] Cluster-derived gating; reference gating; batch gating (TS)
- [ ] Neural / AI-assisted gating (defer to ML phase)

### E7 · Population management
- [x] Population tree; union/intersection/subtraction (boolean) (TS)
- [~] Rename / annotate / label (controller node fields)
- [ ] Merge / split populations as first-class ops (TS) ← next
- [ ] Population matching across samples (TS)
- [ ] Population tracking (longitudinal) (TS)

### E8 · Statistics  (port: flowCore, CytoExploreR)
- [x] Counts, % parent, % total, mean, median (MFI), geomean, CV, MAD, percentile, min/max, stdev (TS)
- [ ] Fold change (TS) ← next
- [ ] Marker positivity (% above threshold) (TS) ← next
- [ ] Marker co-expression (TS) ← next
- [ ] Diversity scores (Shannon/Simpson) (TS) ← next
- [ ] Absolute counts (with bead/volume) (TS)
- [ ] Enrichment scores (TS)

### E9 · Dimensionality reduction  (port: scikit/Rtsne/uwot/PHATE)
- [ ] PCA (covariance + Jacobi eigen, exact) (TS) ← next
- [ ] MDS / classical (TS)
- [ ] t-SNE (Barnes–Hut) (TS→RS)
- [ ] UMAP (port: uwot) (TS→RS)
- [ ] PaCMAP / TriMap / PHATE / Diffusion Maps / Isomap / ICA / NMF (RS)
- [ ] Autoencoders / VAE (defer; onnxruntime-web)

### E10 · Clustering  (port: FlowSOM, PhenoGraph, scikit)
- [ ] K-means (Lloyd, seeded) (TS + **RS** assign step) ← next
- [ ] FlowSOM (SOM grid + metaclustering on k-means) (TS→RS)
- [ ] PhenoGraph (kNN graph + Louvain/Leiden) (TS→RS)
- [ ] Hierarchical / DBSCAN / HDBSCAN / GMM / spectral / consensus (TS→RS)

### E11 · Batch effects / normalization  (port: CytoNorm, CATALYST)
- [ ] Quantile normalization (TS) ← after DR/cluster
- [ ] CytoNorm (per-cluster quantile alignment) (TS)
- [ ] Reference / control-based normalization; drift correction (TS)

### E12 · Differential analysis  (port: diffcyt, CATALYST)
- [ ] Differential abundance (per-population freq across groups + test) (TS) ← next
- [ ] Differential expression / marker intensity (TS)
- [ ] Between-group / longitudinal / responder analysis (TS)

### E13 · Multi-sample
- [ ] Sample groups / cohort metadata model (TS)
- [ ] Population frequency matrices; sample similarity; consensus populations (TS)

### E14 · Workspace serialization & history  (port: flowWorkspace, CytoML)
- [ ] Workspace document schema (gates + transforms + metadata + populations) → JSON (TS) ← next
- [ ] Save / load project (TS) ← next
- [ ] Undo / redo; analysis history; audit trail (TS)
- [ ] FlowJo `.wsp` import (CytoML) ; Cytobank / CytoML import (TS)
- [ ] Reproducibility manifest (params + versions) (TS)

### E15 · Machine learning  (onnxruntime-web / linfa-RS)
- [ ] Cell/population classification (RandomForest/XGBoost/SVM) (RS: linfa, or onnx)
- [ ] Feature importance / explainable AI (TS)
- [ ] Population/disease prediction; biomarker discovery (TS)

### E16 · Modality specifics
- [ ] CyTOF: bead normalization, debarcoding, signal-drift correction (port: CATALYST) (TS→RS)
- [ ] Spectral flow: signature fitting, residual analysis, reference library (TS→RS)
- [ ] Spatial: coordinates, neighborhood, cell–cell interaction, spatial clustering (TS→RS)

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
