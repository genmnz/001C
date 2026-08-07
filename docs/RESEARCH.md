# joeee: Research register (`TODO:RESEARCH` / `@@@research`)

> **This file is an INDEX, not the source of truth.** Each item still lives (and is resolved)
> in its **owning doc or code file**. This page collects them so nothing is lost between
> greps. When you resolve one, update the owning file **and** strike the row here.

The two markers and the discipline behind them are [`CLAUDE.md`](../CLAUDE.md) §1a. The short
version: when a task needs something you do not have in hand (an algorithm, a coefficient, a
parameter table, a validation oracle, a real dataset) you do **not** invent it. You mark it,
ship the honest proxy or nothing, and register it here.

A row is resolved only when: the authoritative source is identified · the implementation is
built from it · the behavior is validated (golden where applicable, `CLAUDE.md` §2) · the
marker is deleted from its owning file · this row is struck through with a date.

## Monitor / regenerate this list

```bash
# every marker, anywhere:
grep -rn "TODO:RESEARCH\|@@@research" --include=*.md --include=*.ts --include=*.rs \
  docs/ packages/ app-react/ scripts/

# every embedded constant table (§1b):
grep -rn "@@@constant" --include=*.ts --include=*.rs --include=*.wgsl packages app-react
```

Created 2026-08-07. Rows below were compiled from the open items already written down in
`ENGINE.md`, `ADVANCED.md`, `VALIDATION.md`, and `ROADMAP.md`, plus a code audit. Each names
where it lives, what would resolve it, and how it would be proven.

**Columns.** *Scope* = what is missing · *Authoritative source* = where the real answer comes
from, never memory · *Target* = the module that will hold it · *Golden oracle* = what proves
it (`CLAUDE.md` §2.2). A row with no oracle names that fact explicitly, because "unprovable
today" is different from "not built yet".

---

## 1. Validation gaps: things we ship that are not yet oracle-proven

These are the highest-priority rows, because unlike the rest of this file they cover code that
**already exists and is already used**.

| ID | Scope | Authoritative source | Target | Golden oracle |
|---|---|---|---|---|
| **V-1** | **asinh / log / linear golden values.** These transforms are self-consistency-tested and closed-form, but not oracle-validated, so a systematic parameterization error would pass. The smallest open validation gap in the repo. | Gating-ML 2.0 transform definitions; FlowKit `transforms.py` | `packages/cytometry-core/test/golden/` (new cases in the existing generator) | **flowutils** `asinh`/`log`/`linear`, added to `scripts/golden/gen_golden.py`. The oracle already provides them; this is a build, not a research project. |
| **V-2** | **Whole-file end-to-end validation.** Every oracle we have is per-operation. Nothing validates the **composite** (`CLAUDE.md` §2.4): parse a real FCS file → compensate → transform → apply a gate hierarchy → count. A per-op-green pipeline can still disagree with FlowJo on a real file, and today we would not know. | ISAC FCS 3.1 (doi:10.1002/cyto.a.20825); Gating-ML 2.0 | new `packages/engine-controller/test/pipeline.golden.test.ts` | **FlowKit** running a whole `GatingStrategy` on a public **FlowRepository** file, or **flowCore + flowWorkspace** gated counts. Needs a licensed, redistributable public dataset chosen first (see **V-3**). |
| **V-3** | **A real, licensed, redistributable FCS test file.** `*.fcs` is gitignored (patient data), and the parser suite is deliberately self-contained via `packages/fcs/test/synth.ts`. That is correct for the parser, but it means **no real vendor file is ever parsed in CI**, and real files violate the spec in ways a spec-correct writer never will. | **FlowRepository** / **ImmPort** / **Cytobank** public experiments, with the licence checked | a documented, versioned fixture path plus a `.gitignore` exception | The file itself is the fixture; the oracle is FlowKit/flowCore's parse of the same bytes. **Blocked on a licence decision, not on technique.** Premise to re-test: that no suitably licensed small file exists. |
| **V-4** | **The WGSL colormap copy is not asserted against the TS copy.** `packages/cytometry-gpu/src/colormap.ts` deliberately duplicates its viridis/inferno anchors into `webgpu/shaders/density_render.wgsl` so CPU and GPU color identically (`CLAUDE.md` §1b), and `test/colormap.test.ts` asserts only the TS side. Two copies nobody compares will diverge. | n/a: this is an internal consistency check, not a science gap | `packages/cytometry-gpu/test/colormap.test.ts` | Parse the anchors out of the `.wgsl` source and assert equality with `colormap.ts`. **Small and buildable now**; tracked in [`TODO.md`](./TODO.md) rather than deferred. |
| **V-5** | **On-device GPU pixel parity.** The GPU bin formula is asserted equal to the CPU histogram, but nothing asserts the **rendered pixels** match `densityToImage`. There is no GPU in CI, so this is manual today. | n/a | `packages/cytometry-gpu` | Requires a GPU runner or a software adapter (Dawn/WARP) in CI. **Premise to re-test:** that no headless WebGPU adapter is usable in this CI. |

## 2. Capability gaps with a published method and a runnable oracle

Buildable now. Each needs the research sweep first (`CLAUDE.md` §1c), then port or clean-room,
then golden (`CLAUDE.md` §2). Owning doc: [`ADVANCED.md`](./ADVANCED.md).

| ID | Scope | Authoritative source | Target | Golden oracle |
|---|---|---|---|---|
| **C-1** | **HDBSCAN.** The one clustering method in the incumbent set we do not have (`ADVANCED.md` §C). | Campello, Moulavi & Sander 2013 (doi:10.1007/978-3-642-37456-2_14) | `packages/cytometry-core/src/cluster/hdbscan.ts` | `scikit-learn` / `hdbscan` (BSD-3), by cluster-label ARI on a seeded fixture, never exact coords (`CLAUDE.md` §2.3) |
| **C-2** | **Full SPADE tree** (density-downsample → cluster → MST → upsample). The downsample half already exists (`sample.densityDependentDownsample`); the tree does not. | Qiu et al. 2011 (doi:10.1038/nbt.1991) | `packages/cytometry-core/src/cluster/spade.ts` | `spade` / `CytoSPADE` reference; MST edge-set comparison on a seeded fixture |
| **C-3** | **opt-SNE** (auto-perplexity, KL-based early exit). The current t-SNE uses fixed defaults, which is the parameterization the field moved off. | Belkina et al. 2019 (doi:10.1038/s41467-019-13055-y) | `packages/cytometry-core/src/reduce/tsne.ts` (an option, not a new module) | `openTSNE` (BSD-3), by iteration-count and neighbor-preservation, not coordinates |
| **C-4** | **DR breadth**: PaCMAP, TriMap, diffusion maps. Different questions, not flavors (`CLAUDE.md` §10). | PaCMAP: Wang et al. 2021 (JMLR 22:201) · TriMap: Amid & Warmuth 2019 (arXiv:1910.00204) · diffusion maps: Coifman & Lafon 2006 | `packages/cytometry-core/src/reduce/` | The reference Python implementations (all permissive), by neighbor-preservation |
| **C-5** | **edgeR-style NB-GLM differential abundance**, plus limma moderated DS. Currently only rank-based DA (Mann-Whitney + BH-FDR) exists, which is the weaker test on small cohorts. | Robinson, McCarthy & Smyth 2010 (doi:10.1093/bioinformatics/btp616); diffcyt (MIT) wraps it | `packages/cytometry-core/src/diff/` | **diffcyt** (MIT) via `Rscript`, on a fixed count matrix. Note edgeR itself is GPL: **clean-room the model from the paper, use diffcyt only as an oracle** (`CLAUDE.md` §2.6). |
| **C-6** | **Trajectory / pseudotime inference.** No module at all; OMIQ ships it and it is a 2025-26 expectation. | Method choice is itself the research: Monocle 3, Slingshot, PAGA, Wishbone all differ in what they claim | `packages/cytometry-core/src/trajectory/` (new) | Depends on the method chosen. **Do not pick one from memory.** |

## 3. Clean-room only: GPL/AGPL sources, paper-first, never paste

These may **only** be built from the publication. The full queue and its rationale live in
[`LICENSES.md`](./LICENSES.md); this table is the index. Opening one of these repositories to
"check an implementation detail" contaminates the clean-room, so **do not open them**.

| ID | Scope | Paper (the only permitted source) | Target | Golden oracle |
|---|---|---|---|---|
| **L-1** | **PHATE** | Moon et al. 2019 (doi:10.1038/s41587-019-0336-3); GPL-2 implementation | `core/reduce/phate.ts` | Structure metrics only (trajectory preservation), never coordinates |
| **L-2** | **EmbedSOM** | Kratochvíl et al. 2019 (doi:10.12688/f1000research.21642.2); GPL-3+ | `core/reduce/embedsom.ts` | Neighbor-preservation vs a seeded FlowSOM fit |
| **L-3** | **PeacoQC / flowAI flow-rate changepoint QC.** `ENGINE.md` §2 lists flowAI changepoint as open; the flowCut-style bin median/MAD QC that exists is a different check, not a substitute. | PeacoQC: Emmaneel et al. 2022 (doi:10.1002/cyto.a.24501), GPL-3 · flowAI: Monaco et al. 2016 (doi:10.1093/bioinformatics/btw191), GPL | `core/cleaning/` | Flagged-event index sets on a fixture with an injected flow-rate anomaly |
| **L-4** | **FlowJo `.wsp` import.** The format is undocumented by the vendor; CytoML (AGPL) is the only complete reader. Reimplement **the format only**, from observed files, never from CytoML's source. | Observed `.wsp` XML from real FlowJo exports; Gating-ML 2.0 for the gate semantics | `packages/engine-controller/src/interop/wsp.ts` | Gated counts from the same workspace applied in FlowJo, compared against ours. **Requires a real `.wsp` plus its FCS file (see V-3).** |
| **L-5** | **GateNet / ML-assisted auto-gating** (`ADVANCED.md` §A). | The method must be chosen and cited before any code. No implementation from memory. | `core/autogate/` | Undecided: name it when the method is chosen. |

## 4. Gaps with no settled definition (cannot be built correctly yet)

Registered so the absence is visible and nobody "fills it in" with a guess (`CLAUDE.md` §9,
document the negative).

| ID | Scope | Why it is blocked | What would unblock it |
|---|---|---|---|
| **U-1** | **Curly-quadrant, spider, and pencil gate shapes** (`ADVANCED.md` §A). FlowJo's exact geometry is proprietary and not in Gating-ML 2.0, so a "reasonable" implementation would silently disagree with FlowJo on real data, which is the worst outcome for a gate. | No published geometric definition. | A published spec, or a derivation validated against FlowJo-exported counts on a shared file (needs **V-3**/**L-4**). |
| **U-2** | **HyperFinder-style gate-sequence discovery**: recapitulate a cluster- or DR-defined population as an optimal, sortable gating path. | The published description is not detailed enough to reimplement the search objective faithfully. | The paper's supplementary methods, or a permissive reference implementation. |
| **U-3** | **Spectral signature library** (`ADVANCED.md` §J). Unmixing ships OLS/WLS/NNLS/Poisson, but there is **no bundled spectra library, deliberately.** Fluorochrome spectra are instrument- and configuration-dependent; a bundled table would be wrong for most users' hardware and is exactly the kind of embedded domain data `CLAUDE.md` §1b forbids. | Not a missing algorithm: a missing **authority binding**. | Resolve spectra from **FPbase** or the user's own single-stain controls at runtime, never from a shipped table. The unmixing math is done; only the sourcing is open. |
| **U-4** | **Zero-copy WASM path** (`ENGINE.md`, WASM wiring). The staging wrapper copies a column into wasm memory per call. The real path backs `EventMatrix` with the module's shared `WebAssembly.Memory`. | Not blocked on science: blocked on the wasm32 4 GB ceiling interacting with multi-GB matrices, which is the keystone constraint in [`DERISKING.md`](./DERISKING.md). Memory64 is still not in Safari. | A sharding design that keeps the matrix in the JS SAB and passes bounded windows. Tracked in [`TODO.md`](./TODO.md); the interface does not change, only `WasmKernels`' internals. |

---

## Resolved

Nothing yet. Resolved rows move here struck through, with the date and a pointer to what
proved them, and are **never deleted**: a row that vanishes reads as a row that never existed,
and the next agent re-opens the question.
