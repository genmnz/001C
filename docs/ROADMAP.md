# Roadmap

The original plan sequenced the build as Day 0 → Day 7. The **sequence is
right** (it's a clean dependency order); the **units are not** — each "day" is
really a milestone that can take days to a week once you account for golden-value
validation and FCS non-conformance. Below is the same order with honest units and
the current state marked.

## Phase 0 — platform de-risk  ·  ~1 week  ·  [partly done]

Prove the things that silently sink the timeline.

- [x] Monorepo + offline `bun test` + `cargo test`.
- [x] Tiny server emits `COOP/COEP/CORP` (verified via curl).
- [x] WGSL + WebGPU density renderer demonstrating the compute→render shared
      `STORAGE` buffer (browser-run still pending — no GPU in CI).
- [ ] Boot a real WebGPU device in a target browser; confirm
      `crossOriginIsolated === true`; render 1M points from a SAB.
- [ ] `wasm-pack`/`cargo build --target wasm32-unknown-unknown` with `+simd128`
      and call `logicle_scale_into` from JS over a SAB slice.

## Phase 1 — parser → matrix  ·  ~3–5 days  ·  [done (TS), hardening ongoing]

- [x] FCS 3.0/3.1 (+2.0-tolerant) list-mode parse: I/F/D, integer bit-mask,
      `$BYTEORD`, HEADER/TEXT offset reconciliation, `$SPILLOVER`.
- [x] Column-major Float32 output → `EventMatrix.fromBuffer` (no transpose).
- [ ] Golden-file corpus from real public files; ASCII (`$DATATYPE A`) and
      multi-dataset (`$NEXTDATA`) support; parse straight into a SAB in a Worker.

## Phase 2 — transforms + compensation  ·  ~1 week  ·  [done, needs oracle]

- [x] logicle/biexp (TS + Rust mirror), asinh, log, linear; round-trip +
      monotonicity + analytic anchors.
- [x] Spillover inversion (f64) + apply.
- [ ] **flowCore/FlowKit golden-value validation** of logicle across a parameter
      grid (the one remaining correctness gate). Per-channel transform overrides.

## Phase 3 — render real data + density  ·  ~1–2 weeks  ·  [scaffolded]

- [x] CPU 2D/1D histogram (source of truth); pure `densityToImage`; colormaps.
- [x] WebGPU scatter (instanced) + GPU histogram + colormap render (WGSL).
- [ ] Logicle-aware axis ticks/gridlines; LOD downsampling for zoomed-out views;
      a `max`-bin reduction pass on GPU; pan/zoom UX; pixel-parity test GPU vs CPU.

## Phase 4 — gating  ·  ~1 week  ·  [done (engine), UX pending]

- [x] rectangle/range/ellipse/polygon/quadrant + boolean (bitset); parent
      restriction; live counts.
- [ ] Interactive draw/edit handles (SVG/Canvas2D overlay on the GL canvas);
      GPU picking/hover; sub-100 ms drag verified at 10M events (move the kernel
      to WASM SIMD if TS misses it).

## Phase 5 — stats + gate tree  ·  ~3–5 days  ·  [done (engine), UI pending]

- [x] count/%parent/%total/mean/median(MFI)/geomean/CV/MAD/percentile.
- [ ] Gate-tree UI, population manager, exportable stats tables.

## Phase 6 — hardening  ·  ongoing

- [ ] 30M-event stress + memory profiling; tab-OOM mitigation; feature-detect
      fallback messaging; the full golden-file suite.

## Explicitly deferred (post-MVP)

UMAP · t-SNE · PCA · FlowSOM · PhenoGraph · Leiden · Louvain · k-means · HDBSCAN ·
FlowJo `.wsp` import · spectral/OLS compensation · DuckDB-WASM (cohort stats) ·
collaboration · reporting/figure builder · ML · pipelines · R/Python consoles.

These are not interactive at 1–10M events and/or not core to "FlowJo Lite." When
they come back, most are Rust→WASM (`linfa`) or server-side, behind the same
controller boundary.
