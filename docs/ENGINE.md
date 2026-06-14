# ENGINE.md — headless core (built first, with tests)

Status of the Operation Catalog's engine tier (§0–§8 + wiring). `[x]` done &
tested · `[~]` partial · `[ ]` todo. Hot loops → Rust/WASM; I/O & orchestration →
TS; pixels → WGSL. Event matrix stays in a JS SharedArrayBuffer. Every numeric
kernel is validated against flowutils/FlowKit (see docs/VALIDATION.md,
docs/LICENSES.md).

## §0 Substrate
- [x] EventMatrix (columnar, SAB-backed) · Population (packed bitset) · Kernels seam (TS⇄WASM)
- [x] Property tests: bitset algebra, columnar round-trip, TS⇄WASM parity

## §1 FCS I/O
- [x] Read + parse metadata/channels/markers/$SPILLOVER (FCS 2.0/3.0/3.1)
- [x] DATA decode: integer bit-mask vs $PnR, $BYTEORD, offset reconciliation, I/F/D
- [x] Write FCS (FCS3.1, float) + read-after-write round-trip  ← `fcs/write.ts`
- [x] Concatenate samples (event-count conservation)  ← `core/sample`
- [x] Downsample events (uniform + reservoir, seeded)  ← `core/sample`
- [x] Export gated population (CSV / column gather)  ← `core/sample`
- [ ] Stream / lazy-load (chunked decode into SAB)
- [ ] Merge/split by metadata; upsample; convert versions; ASCII/multi-dataset

## §2 Data cleaning / QC
- [x] Saturation / margin / boundary removal  ← `core/cleaning`
- [x] Singlet (A/H ratio) · debris (low FSC/SSC) · time-window  ← `core/cleaning`
- [x] flowCut-style bin median/MAD anomaly QC  ← `core/cleaning/qc`
- [ ] PeacoQC isolation-tree + density-peak (clean-room); flowAI changepoint
- [ ] Instrument-drift detection (time-binned median)

## §3 Compensation
- [x] Apply matrix `inv(Sᵀ)·obs` (oracle-validated) + f64 inversion (TS + RS)
- [x] Spillover from single-stain controls (median)  ← `core/compensation/spillover`
- [x] Spectral unmixing OLS + NNLS (Lawson-Hanson)  ← `core/compensation/unmix`
- [ ] WLS/Poisson unmixing; autofluorescence extraction/subtraction; auto-comp

## §4 Transformations
- [x] logicle (oracle ~5e-17, TS+RS) · hyperlog (~3e-17) · asinh(+cofactor) · log · linear
- [x] Inverse transforms; channel-specific application
- [x] estimateLogicle (auto-W from negatives)  ← `core/transforms/estimateLogicle`
- [x] Quantile transform  ← `core/transforms/quantile`
- [ ] Custom/user formula; FlowJo-distinct biexponential parameterization

## §5 Manual gating
- [x] rectangle/range/ellipse/polygon/quadrant (oracle-validated; RS poly)
- [x] boolean AND/OR/NOT/XOR/diff (bitset); parent-child hierarchy
- [ ] gate templates / copy-paste / sync / versioning

## §6 Population management
- [x] tree (controller); union/intersection/subtraction/diff (boolean)
- [x] merge / split-by-threshold as first-class ops  ← `core/sample` / `autogate`
- [~] rename/annotate/label (controller node fields)
- [ ] cross-sample matching / tracking

## §7 Statistics
- [x] counts · %parent · %total · mean · median(MFI) · geomean · CV · MAD · percentile
- [x] fold-change · positivity · co-expression · Shannon/Simpson · Mann-Whitney · diff-abundance
- [ ] enrichment scores · absolute counts (beads/volume)

## §8 Density (engine source of truth)
- [x] 1D/2D histogram binning (conservation-tested)
- [x] Contour lines — marching squares  ← `core/density/contour`
- [x] Hexbin  ← `core/density/hexbin`
- [x] KDE 1D (Gaussian, Silverman bandwidth)  ← `core/density/kde`
- [x] 2D KDE (Gaussian product kernel) ← `core/density/kde`
- [ ] violin/ridge density primitives

## Engine WASM wiring
- [x] wasm32 + simd128, raw C ABI; logicle/poly/compensate/kmeans kernels exported
- [x] TS⇄WASM parity tests; staged-over-`__heap_base` calling path
- [ ] Zero-copy: back WebAssembly.Memory with the EventMatrix SAB; worker sharding

## Engine WebGPU wiring
- [x] Compute→render shared STORAGE buffer; GPU 2D-histogram density (WGSL)
- [x] GPU bin formula == CPU histogram (parity test); logicle-aware axis ticks
- [ ] Instanced scatter on real data; LOD downsample; GPU max-bin reduction; picking; on-device pixel parity
