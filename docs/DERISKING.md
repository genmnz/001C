# De-risking review

This is the opinionated review behind the scaffold: what the plan gets right,
what I'd rethink, and the things to prove before they sink the timeline. It
folds in the prior research doc and a round of fact-checking done June 2026 (my
training cutoff is January 2026, so the perishable claims were re-verified).

## Verdict

The plan is sound and the hard parts were correctly identified. The single most
important decision — **keep the multi-GB event matrix in a JS `SharedArrayBuffer`,
not the WASM heap** — is not just defensible, it's *forced*, and the scaffold is
built around it. Three things deserve a sharper line than the original doc drew:
the "1 week" framing, where the density math lives, and treating WebGPU-only as
free. Details below.

## What I re-verified (June 2026)

- **WebGPU support is real but uneven.** caniuse (Feb 2026) ≈ **87% desktop /
  71% mobile**, ~82% global. Chrome since 113 (2023); Safari shipped it and it's
  on by default in the 26 line (macOS Tahoe 26 / iOS 26, 2025); Firefox shipped
  it (141, 2025) but its **default-on status across platforms is still settling**
  as of mid-2026, and Linux/Android remain partial. → WebGPU-first is fine, but
  Firefox + older iOS + Linux is a bigger hole than "evergreen only" implies.
  Keep a fallback seam (the scaffold has one).
- **Memory64 is still NOT in Safari** (Chrome + Firefox only) in 2026. This
  *confirms* the keystone decision: do not rely on wasm64 to break the 4 GB
  ceiling; keep big arrays in a JS `SharedArrayBuffer`.
- **No mature JS/TS (or Rust) flow-cytometry engine exists.** Still true. The
  only JS FCS parser of note (MorganConrad/fcs) is basic and has no gating.
  There is a Swift `FlowKit` (xwu/FlowKit) implementing FCS 3.1 + Gating-ML 2.0
  that's a readable secondary reference, but nothing to adopt wholesale. You are
  building the engine; OSS value is as algorithm reference + golden-value oracle.
- **The logicle patent (Stanford) is real.** Stanford owns logicle-related
  patents from 2005 (method by Parks, Roederer & Moore). The reference code is
  BSD-licensed and the transform is in Gating-ML 2.0; downstream projects treat
  it as not enforced for flow cytometry. Get legal sign-off before commercial
  distribution anyway.

Sources: [caniuse WebGPU](https://caniuse.com/webgpu) ·
[web.dev: WebGPU in major browsers](https://web.dev/blog/webgpu-supported-major-browsers) ·
[gpuweb implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) ·
[caniuse Memory64](https://caniuse.com/wf-wasm-memory64) ·
[FlowKit (Python)](https://github.com/whitews/FlowKit) ·
[Robust FCS Parsing, Bras & van der Velden 2020](https://onlinelibrary.wiley.com/doi/abs/10.1002/cyto.a.24187).

## What the plan gets right (keep)

1. **SAB-on-the-JS-heap, not the WASM heap.** 30M × 50 × 4 B ≈ 6 GB blows
   wasm32's hard 4 GB ceiling. Keeping the matrix in a `SharedArrayBuffer` and
   passing slice pointers into WASM kernels sidesteps it *and* lets Workers + the
   GPU uploader share bytes with zero copies. → `EventMatrix` (core), the raw
   C-ABI kernels (wasm).
2. **TS engine first; port only the hot kernels to Rust.** Most of the engine is
   I/O and orchestration. Only logicle/biexp, compensation, point-in-polygon, and
   percentile want SIMD. → `cytometry-wasm` is exactly that small surface and
   nothing more.
3. **Logicle is the keystone correctness risk.** It's the FlowJo default for
   fluorescence and everything downstream (render, gating, stats) depends on
   correct transformed coordinates. → It's the first thing built and the most
   heavily tested (TS *and* Rust), with analytic anchors `B(x1)=0`, `B(1)=T`.
4. **Arrow as columnar backbone; DuckDB-WASM deferred.** DuckDB-WASM is multi-MB
   and competes for the same RAM as your 6 GB of events. Right to keep it as a
   Phase-2 accelerator, not the primary store. (The scaffold uses raw typed
   arrays and is Arrow-*compatible* by layout; Arrow interop is an adapter, not a
   core dependency.)
5. **Defer all clustering/DR.** UMAP/t-SNE/FlowSOM/Leiden are not interactive at
   1–10M events and not core to "FlowJo Lite." Deferred.
6. **Prove COOP/COEP + WebGPU compute→render sharing on day one.** These are the
   silent timeline-killers. The server emits the headers (verified); the WGSL +
   density renderer demonstrate the shared `STORAGE` buffer pattern.
7. **FCS parsing is defensive by necessity.** Only ~0.7% of public files fully
   conform. → The parser handles the integer bit-mask vs `$PnR`, `$BYTEORD`,
   HEADER/TEXT offset disagreement, and collects warnings instead of throwing.

## What I'd rethink (the criticisms)

1. **The "1 week" is fiction; the *sequence* is gold.** Day0→Day7 is an
   excellent dependency order, but calling each phase "a day" is a trap. A
   logicle validated against flowCore golden values is a day by itself; a parser
   that survives the 0.7%-conformance reality is several. Realistic: platform
   de-risk ≈ 1 week, a solid headless core ≈ 3–5 weeks, a credible MVP with
   polished WebGPU ≈ 8–12 weeks. See ROADMAP.md — same order, honest units.
2. **Put the density/binning math in the engine, not (only) the shader.** The
   original plan has density as a GPU compute shader with a "CPU fallback." Flip
   the emphasis: the 2D-histogram is the *source of truth* in
   `cytometry-core/density`, unit-tested headlessly; the WebGPU compute pass is
   an **accelerated mirror** that must produce identical bins. Otherwise plots
   can't be regression-tested and "headless-first" breaks exactly where it
   matters. → `histogram2d` (core) + `densityToImage` (gpu, pure) are both tested.
3. **WebGPU-only is a bet — keep the seam.** Stay WebGPU-first in implementation,
   but code rendering behind a `Renderer` interface so a Canvas2D (small-N /
   thumbnails / Firefox-Linux / old iOS) or future WebGL2 backend is a new file,
   not a rewrite. The cost is ~one interface; the Firefox/iOS/Linux gap makes it
   cheap insurance. → `renderer.ts` + `Canvas2DRenderer`.
4. **The UX "Cytometry Pro Workstation" spec is a north star, not a backlog.**
   Ten modes, real-time collaboration, LIMS, dual R/Python consoles, ML
   everywhere — taking it literally will sink you. The honest MVP is the friend's
   "FlowJo Lite": load → scatter/histogram → gate → gate tree → stats → export.
   Everything else is post-MVP, and the agnostic-UI architecture is precisely what
   lets the spec stay aspirational without polluting the engine.
5. **"Completely local" still needs the tiny server.** `file://` can't set
   COOP/COEP and can't use SAB threads. The "tiny server" isn't optional if you
   want threads — but its entire job is "serve static files + 2 headers" (~40
   lines; see `server/serve.ts`). Single-threaded WASM is the only true-local
   fallback.
6. **The bitset *is* the architecture — name it.** Make "a population = a packed
   bitset over the shared event matrix" a first-class primitive: gates produce
   bitsets, boolean gates are word-wise ops, stats reduce over set bits, the GPU
   colors by membership. This is what keeps the gate-drag loop at <100 ms at 10M
   events. → `Population`.
7. **DuckDB-WASM dismissal is right for the store, too harsh for cohort stats.**
   Keep it deferred, but earmark it specifically for *cross-sample* analytical
   stats (GROUP BY over a cohort, frequency-of-parent across many samples) where
   hand-writing kernels is silly. *Per-gate live* stats stay in the
   bitset-reduction path. Split by use-case, not "DuckDB bad."
8. **Worker topology: a small pool, not one mega-worker.** One IO/parser worker +
   1–2 compute workers, main thread for GPU submission + UI. SAB makes it clean;
   over-threading just adds COOP/COEP surface for diminishing returns. The
   controller's backend interface already abstracts this.

## Pitfalls to wire up on day one

- **Cross-origin isolation.** Need `COOP: same-origin` + `COEP: require-corp`;
  verify `self.crossOriginIsolated === true` at runtime. Any cross-origin
  `<img>`/script/font/iframe must send CORP or be self-hosted, or COEP blocks it.
  `COEP: credentialless` is the softer option. Route auth/payments via redirect,
  not embed. → server sets all three; Vite config sets dev headers.
- **wasm32 4 GB ceiling.** Covered above — SAB on the JS heap; never copy the
  matrix into WASM.
- **Tab memory.** 6 GB will OOM many tabs regardless. Implement level-of-detail
  downsampling (render a representative sample when zoomed out, full-res on zoom)
  and stream/chunk the FCS parse.
- **Float precision.** f32 is fine for rendering and most stats, but logicle
  root-finding and compensation inversion must be **f64** (they are here),
  downcast only for display. Integer channels wider than 24 bits lose precision in
  f32 storage — the parser warns.
- **FCS non-conformance.** Build a golden-file corpus across versions / datatypes
  / endianness / with-and-without `$SPILLOVER`, plus deliberately malformed
  files. The parser's `writeFcs` test helper is the start of this.

## Borrow / Port / WASM — per feature

| Feature | Approach | Mine from | Why |
|---|---|---|---|
| FCS parsing | reimplement in TS | FlowIO (BSD-3) byte layout; MorganConrad/fcs | I/O-bound; keep data on the JS heap |
| Compensation | Rust→WASM kernel, f64 inverse | FlowUtils; standard linear algebra | mat-vec over millions of rows; SIMD |
| Transforms (logicle/biexp) | **port** to Rust→WASM | Moore–Parks BSD reference; FlowUtils `_logicle.c` | the fiddly piece; validate vs flowCore |
| asinh / log / linear | TS (trivial) | GatingML 2.0 | closed-form |
| Gating (poly/rect/…) | Rust→WASM point-in-polygon; boolean as bitset | FlowUtils `gate_c_ext`; PNPOLY | hottest path on drag |
| Stats (count/median/MFI/…) | TS simple; Rust for percentile/MAD | hand-written | reductions over a bitset |
| Density / contour | WebGPU compute (primary) + CPU source-of-truth | ChartGPU density mode; WebGPUFundamentals histogram | embarrassingly parallel |
| UMAP/t-SNE/FlowSOM/Leiden/… | **defer** | — | not interactive at scale, not core |

**Do not** WASM-wrap FlowUtils' C directly: it's NumPy-C-API-coupled, and the
algorithms are small enough to port cleanly to Rust (memory safety + SIMD + one
toolchain). Port the math, preserve the BSD/Stanford attributions.

## Caveats

- The logicle here passes round-trip, monotonicity, and analytic anchors in both
  TS and Rust, but per the plan it **still needs flowCore/FlowKit golden-value
  validation** before production (the harness is a documented next step).
- WebGPU/DuckDB performance figures in circulation are vendor benchmarks on
  unspecified hardware — directional; validate on your target devices.
- FlowUtils C line counts couldn't be re-fetched here; clone the repo/sdist to
  confirm before budgeting the port.
