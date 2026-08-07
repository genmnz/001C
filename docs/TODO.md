# joeee: global TODO

The single backlog of **open and unfinished work** across the repo, compiled from the owning
docs, the code, and the git history. Each item says **where it lives** and carries enough
context to be picked up cold. Last reconciled against the code: **2026-08-07**.

**Before starting anything here, read [`CLAUDE.md`](../CLAUDE.md) =
[`AGENTS.md`](../AGENTS.md).** The living status docs override anything stale here:
[`ENGINE.md`](./ENGINE.md) and [`ADVANCED.md`](./ADVANCED.md) are the source of truth for what
the engine has; [`RESEARCH.md`](./RESEARCH.md) is the source of truth for what must not be
invented.

**Legend:** 🔴 not started · 🟡 in progress / partial · 🔵 blocked (external) · 🧊 deliberately
deferred, with the reason · ✅ shipped (kept only as a pointer)

---

## 1. Correctness and integrity in the app (do these first)

These are not features. They are places where the UI presents a fabricated or hidden value as
a scientific result, which is the one thing `CLAUDE.md` §1 forbids outright.

- 🔴 **The demo spillover matrix is fabricated.** `app-react/src/App.tsx`, the `compensate`
  action, calls `controller.compensate({ channels: ["FSC-A", "CD3"], values: [1, 0.12, 0.05, 1] })`
  and logs "Compensation applied (demo spillover)". Those four numbers are invented, they are
  applied to the user's real data if a real file is loaded, and the log line reads like a
  successful operation. **This is a §1 violation, not a placeholder.** Replace with the real
  path: read `$SPILLOVER` from the loaded file (the parser already extracts it), or compute
  from single-stain controls (`compensation/spillover` already exists), or show a matrix editor
  and require the user to fill it. Never ship invented coefficients.
- 🔴 **Hardcoded operation parameters, with no controls.** Also `App.tsx`: clustering is fixed
  at `k = 8`, `downsampleTo: 2000`, `seed: 1`; the polygon gate has fixed vertices
  `[[0.55,0.55],[0.95,0.55],[0.95,0.95],[0.55,0.95]]`; `importGatingML` parses a hardcoded
  inline XML string rather than a file the user chose. Every one of these is a §10 parity
  violation (a hidden default a scientist cannot see or change). Surface them as real controls.
- 🔴 **Synthetic demo data is not labelled as synthetic.** `synthClusters()` loads as
  `demo.fcs`, which reads like a file. Under the §1a-pre carve-out, generated data is fine and
  **mislabelled** generated data is not. Name it what it is in the workspace.
- 🔴 **The WGSL colormap copy is never compared to the TS copy** (**V-4** in
  [`RESEARCH.md`](./RESEARCH.md)). `colormap.ts` duplicates its viridis/inferno anchors into
  `webgpu/shaders/density_render.wgsl` on purpose so CPU and GPU color identically, and
  `test/colormap.test.ts` asserts only the TS side. Parse the anchors out of the `.wgsl` and
  assert equality. Small, buildable now, no research needed.

## 2. Validation: close the oracle gaps

Owning doc: [`VALIDATION.md`](./VALIDATION.md). Full detail in
[`RESEARCH.md`](./RESEARCH.md) §1.

- 🔴 **asinh / log / linear goldens** (**V-1**). flowutils already provides them; add the cases
  to `scripts/golden/gen_golden.py`. The smallest open validation gap in the repo.
- 🔴 **End-to-end composite golden** (**V-2**): parse → compensate → transform → gate hierarchy
  → counts, against FlowKit's `GatingStrategy` or flowCore + flowWorkspace. Every oracle today
  is per-operation, and per-op-green does not imply pipeline-correct (`CLAUDE.md` §2.4).
  Depends on **V-3**.
- 🔵 **A real, licensed FCS fixture** (**V-3**). Blocked on a licence decision, not on
  technique: pick a redistributable public file from FlowRepository / ImmPort. Today **no real
  vendor file is ever parsed in CI**, only spec-correct synthetic ones, and real files break
  the spec in ways a correct writer never will. **Premise to re-test:** that no suitably
  licensed small file exists.
- 🔵 **On-device GPU pixel parity** (**V-5**). Bin parity is asserted; rendered pixels are not,
  and there is no GPU in CI. **Premise to re-test:** that no headless WebGPU adapter
  (Dawn/WARP/software) is usable in this CI.
- 🟡 **The WASM parity test skips silently when the artifact is absent.** `kernels.wasm.test.ts`
  is 3 of the 3 skips in a default `bun test` run. CI builds the wasm first so it runs there,
  but a green local run does not prove TS/WASM parity. Consider failing loudly when the
  artifact is missing **and** an env flag says it should be present.

## 3. Engine to UI parity: capabilities the engine has and the app does not surface

Owning docs: [`ENGINE.md`](./ENGINE.md), [`ADVANCED.md`](./ADVANCED.md), `CLAUDE.md` §10 and
§11. The engine is far ahead of the UI, which is the repo's largest structural gap. Each of
these is a real, tested controller capability with no or partial UI:

- 🔴 **Gate templates** (`saveGateTemplate` / `applyGateTemplate`, with channel remap): no UI.
- 🔴 **Workspace import** (`importWorkspace`): export is wired, import is not, so a saved
  analysis cannot be reopened. This is the one that reads as data loss.
- 🔴 **Cleaning and QC** (margin, singlet, debris, saturation, time-window, flowCut bin
  median/MAD, isolation-forest, drift detection): a whole engine tier with no surface.
- 🔴 **Spectral unmixing** (OLS / WLS / NNLS / Poisson, plus the autofluorescence column) and
  **PMT normalization**: no surface.
- 🔴 **CyTOF** (debarcoding, bead normalization, isotope spillover): no surface.
- 🔴 **Auto-gating** (Otsu, density-valley, quantile, tail): no surface.
- 🔴 **Differential abundance**, **CytoNorm**, **multi-sample matching and tracking**,
  **proliferation indices**, **spatial neighborhood enrichment**, **logistic ML**: no surface.
- 🔴 **Most plot types.** [`PLOTS.md`](./PLOTS.md) marks hexbin, contour, backgated, 1D
  histogram, overlay/ridgeline, 2D KDE, quadrant, violin/box/swarm, and the QC plots as ◑ or ○.
  The note there is the important part: these need **UI wiring, not new engine math**. The
  primitives exist and are tested.
- 🔴 **Multi-sample anything.** The engine has concatenate, downsample, similarity, matching,
  and tracking; the app is single-sample.

## 4. Engine gaps (§0 to §8)

Owning doc: [`ENGINE.md`](./ENGINE.md).

- 🔴 **FCS streaming / lazy chunked decode into the SAB** (§1), and **multi-dataset
  `$NEXTDATA`**, ASCII data, version conversion, merge/split by metadata, upsample.
- 🔴 **flowAI flow-rate changepoint QC** (§2). Registered as **L-3**: GPL, so clean-room from
  the paper. The existing flowCut-style bin median/MAD QC is a *different* check, not a
  substitute.
- 🔴 **Gate copy / paste / sync across samples, and gate versioning** (§5).
- 🟡 **Population rename / annotate / label** (§6) is partial (controller node fields exist, no
  UI).
- 🧊 **Zero-copy WASM path** (**U-4**). Deferred under `CLAUDE.md` §11 reason 1: the design is
  constrained by the wasm32 4 GB ceiling and Memory64's absence from Safari
  ([`DERISKING.md`](./DERISKING.md)), so the sharding design must be settled before code. The
  interface does not change; only `WasmKernels`' internals do.
- 🔴 **WebGPU**: instanced scatter on real data, LOD downsampling, GPU max-bin reduction,
  picking.

## 5. Advanced tiers (A to N)

Owning doc: [`ADVANCED.md`](./ADVANCED.md), which is the source of truth. Research detail for
each is in [`RESEARCH.md`](./RESEARCH.md) §2 and §3.

- 🔴 **HDBSCAN** (**C-1**) and the **full SPADE tree** (**C-2**). The only clustering methods in
  the incumbent set we lack.
- 🔴 **opt-SNE** (**C-3**) and **DR breadth**: PaCMAP, TriMap, diffusion maps (**C-4**).
- 🔴 **edgeR-style NB-GLM differential abundance** (**C-5**), plus limma moderated DS, GLMM,
  survival. Current DA is rank-based only, which is the weaker test on small cohorts.
- 🔴 **Trajectory / pseudotime** (**C-6**). No module. The method choice is itself the research:
  do not pick one from memory.
- 🔴 **GMM-based 2D gating.** The GMM backbone exists (`cluster/gmm`); wiring it to 2D gates
  does not.
- 🔴 **RF / SVM / NN**, feature importance and SHAP (§G). **Rare and novel population
  detection**, atlas mapping (§D). **Cell-cell interaction**, spatial clustering, tissue-region
  annotation (§H). **Cohort aggregation** and consensus populations (§K). **Audit trail** (§L).
- 🧊 **PHATE** (**L-1**) and **EmbedSOM** (**L-2**): clean-room only, GPL. Do not open the
  implementations.
- 🧊 **FlowJo `.wsp` import** (**L-4**): the format is undocumented and CytoML is AGPL, so it
  must be reimplemented from observed files. Depends on **V-3** for a test fixture.
- 🧊 **Curly-quad / spider / pencil gates** (**U-1**) and **HyperFinder** (**U-2**): no
  published definition precise enough to match FlowJo, and a gate that silently disagrees with
  the incumbent is worse than an absent one.
- 🧊 **Spectral signature library** (**U-3**): deliberately not bundled. The unmixing math is
  done; spectra must resolve from FPbase or the user's own controls at runtime, never from a
  shipped table (`CLAUDE.md` §1b).
- 🧊 **Collaboration (§M) and enterprise (§N)**: explicitly last by design, per
  [`ROADMAP.md`](./ROADMAP.md).

## 6. Repo hygiene and tooling

- ✅ **`typescript` was missing entirely**, so `bun run typecheck` could not run and the CI
  step was failing rather than passing. Fixed 2026-08-07.
- ✅ **`app-react` was excluded from the typecheck.** Fixed 2026-08-07 as its own step.
- 🔴 **No linter or formatter exists.** No Biome, no ESLint, no Prettier, no editorconfig.
  Formatting is by convention and drifts. Adding one is a real decision with a real diff, so it
  is listed here rather than smuggled into another change (`CLAUDE.md` §4). Biome is the
  cheapest fit for a Bun workspace.
- 🔴 **Boundary rules are prose, not checks.** `CLAUDE.md` §3's two hardest invariants are
  grep-checkable and belong in CI: no `@joeee/cytometry-core` import from `app-react` or
  `app-web`, and no DOM/framework import inside `cytometry-core`. A ten-line CI step would
  enforce what a doc currently only asks for.
- 🔴 **The `LICENSES.md` row rule is not enforced.** `CLAUDE.md` §2.6 makes it blocking, but
  nothing checks that a new module under `cytometry-core/src/<algorithm>/` has a row. This is
  the highest-risk unenforced policy in the repo.
- 🔴 **`bash.exe.stackdump` reappears at the repo root** and is not gitignored.
- 🟡 **`app-web` is kept on purpose** as the framework-agnosticism proof (`CLAUDE.md` §0), but
  it has no scripts, no tests, and **is not built by CI**, so nothing would catch it breaking.
  Either add a typecheck step for it or the proof decays into a claim. Recorded here so "kept
  deliberately" stays distinguishable from "forgotten".
- 🟡 **`ROADMAP.md`'s Phase E checkboxes self-declare that they lag the code.** Either reconcile
  them against `ENGINE.md` or retire the section and point at `ENGINE.md`/`ADVANCED.md`, which
  are accurate. A doc that documents its own staleness is still stale.
