# joeee: Source register

**Every URL a sweep actually opened, one row each.** Created 2026-08-07 under
[`CLAUDE.md`](../CLAUDE.md) §1c ("write down every source you fetched").

**How to use it.** Add a row when you fetch a page during a sweep. Cite the *durable* page (a
specification, a reference implementation's source file at a path, a release note, a
datasheet), **never a search-results URL**. Group rows under a `## <topic>, <YYYY-MM-DD>`
heading that names the owning doc.

**Verdict vocabulary, exactly three:**

- **Used** = the code or a decision stands on it.
- **Ruled out** = read and rejected, **with the reason**. This is the half that pays: a row
  recorded as "ruled out: this is the Swift FlowKit, not the Python one" saves the next agent
  an hour on the same collision.
- **Context** = read for orientation; nothing stands on it.

---

## Seed: citations already carried by the existing docs, 2026-08-07

Owning docs: [`LICENSES.md`](./LICENSES.md), [`VALIDATION.md`](./VALIDATION.md),
[`DERISKING.md`](./DERISKING.md).

> **Honest provenance note, because it changes how you should treat this section.** These rows
> were **not** produced by a sweep run on 2026-08-07. They are the citations that the repo's
> existing docs already stand on, transcribed into this register when it was created, so the
> register starts complete rather than empty. **The DOIs and repository names are recorded as
> the docs state them; the pages were not re-fetched at transcription time.** Treat a row here
> as a pointer to verify, not as a page someone read that day. Rows added from here on follow
> the normal rule: one row per URL actually opened.

| URL / path | What it is | Verdict |
|---|---|---|
| doi:10.1002/cyto.a.20825 | **ISAC FCS 3.1 specification.** The authority for `packages/fcs` (parse and write). | **Used**: `fcs/{parse,write}` is a reimplementation from this spec |
| ISAC **Gating-ML 2.0** recommendation | The authority for gate serialization and for the transform definitions (logicle, hyperlog, asinh, log, linear). Drives `engine-controller/interop/gatingml.ts`. | **Used**: gate semantics and transform parameterization |
| Moore & Parks 2012, logicle / biexponential display (Stanford reference implementation) | The origin of the logicle transform and of the C code flowutils wraps. | **Used**: `transforms/logicle`, and the reason `NOTICE` exists |
| doi:10.1002/cyto.a.20114 (Bagwell 2005) | **Hyperlog.** | **Used**: `transforms/hyperlog` |
| https://github.com/whitews/FlowUtils | **flowutils**: FlowKit's C extensions (BSD-3). **This is the golden oracle** for logicle, hyperlog, compensation, and gating geometry. Pinned in `scripts/golden/requirements.txt`. | **Used**: every golden in `packages/cytometry-core/test/golden/` |
| https://github.com/whitews/FlowKit | **FlowKit** (Python, BSD-3): transforms, gating, `GatingStrategy`. | **Used**: reference for `transforms/*` and `gating/*`; also the intended oracle for the end-to-end composite golden (**V-2** in [`RESEARCH.md`](./RESEARCH.md)) |
| https://github.com/whitews/FlowIO | **FlowIO** (BSD-3): minimal FCS reader. | **Used**: reference for the parser |
| https://github.com/xwu/FlowKit | A **Swift** FCS 3.1 + Gating-ML 2.0 implementation. Same name, different project, different language. | **Ruled out**: nothing to adopt wholesale; a readable secondary reference only. **Recorded because the name collides with the Python FlowKit above**, which is our actual oracle |
| https://github.com/MorganConrad/fcs | The only JS FCS parser of note. | **Ruled out**: basic, no gating, no write path. Confirms the "no mature JS/TS cytometry engine exists" premise in [`DERISKING.md`](./DERISKING.md) |
| PMC4177998 (Novo et al.) | **Spectral unmixing** (OLS / WLS / NNLS). | **Used**: `compensation/unmix`, reimplemented from the paper (normal equations + Lawson-Hanson NNLS) |
| Bioconductor **flowCore** (Artistic-2.0) | `estimateLogicle` (auto-W from negatives), `spillover()` from single-stain controls, boundary filters. | **Used**: clean implementations of the published formulas; Artistic-2.0 permits porting with attribution |
| Bioconductor **flowDensity** (Artistic-2.0) / **openCyto** (AGPL) | 1D auto-thresholding: `deGate` / `gate_mindensity`. | **Used (flowDensity)** for `autogate/threshold1d` · **Ruled out as a source (openCyto)**: AGPL, so the density-valley method was reimplemented from the paper, never from openCyto's code |
| **Spectre** (MIT) | `do.subsample`, diversity and comparison statistics. | **Used**: `sample/{concat,downsample}`, parts of `stats/*` |
| **d3-contour** (ISC/BSD) | Marching squares over our density bins. | **Used**: the algorithm for `density/contour`; D3 is a toolkit here, never the renderer ([`PLOTS.md`](./PLOTS.md)) |
| doi:10.1002/cyto.a.22625 (FlowSOM) | SOM + MST + metaclustering. Implementation is GPL≥2. | **Used (paper only)**: `cluster/flowsom` is a clean-room from the publication. **The GPL implementation was deliberately not opened** ([`LICENSES.md`](./LICENSES.md)) |
| doi:10.1038/s41598-019-41695-z (PhenoGraph) | kNN → Jaccard → community detection. | **Used (paper only)**: clean-room |
| doi:10.1002/cyto.a.23904 (CytoNorm) | Per-cluster quantile normalization to a goal. GPL≥2. | **Used (paper only)**: clean-room, `core/normalize` |
| doi:10.1002/cyto.a.24501 (PeacoQC) | Flow-rate / signal-stability QC. GPL-3. | **Context**: queued as **L-3** in [`RESEARCH.md`](./RESEARCH.md); not built |
| doi:10.12688/f1000research.21642.2 (EmbedSOM) | Fast SOM-based embedding. GPL-3+. | **Context**: queued as **L-2**; not built |
| Finck et al. 2013 / Zunder et al. (CyTOF bead normalization and debarcoding) | The methods behind `core/cytof`. | **Used**: reimplemented from the publications |
| Roederer, proliferation / division indices | Division, proliferation, expansion, and replication indices from a CFSE peak ladder. | **Used**: `core/proliferation` |
| https://caniuse.com/webgpu | WebGPU browser support. Re-verified June 2026: ~87% desktop / 71% mobile; Firefox default-on status still settling; Linux and Android partial. | **Used**: justifies keeping the Canvas2D fallback seam ([`DERISKING.md`](./DERISKING.md)) |
| WebAssembly **Memory64** status | Still not in Safari as of 2026 (Chrome and Firefox only). | **Used**: this is *the* load-bearing constraint: it forces the multi-GB event matrix into a JS `SharedArrayBuffer` rather than the WASM heap, which the whole architecture is built around |
| US Patent 6,954,722 (Stanford; Parks, Roederer & Moore) | The logicle-related patent. | **Used**: the basis of the repo-root `NOTICE` and its field-of-use position. Not legal advice; get sign-off before commercial distribution |

## Authorities to resolve from at runtime, never to bundle

Recorded here because `CLAUDE.md` §1b forbids embedding this data, so the *absence* of a
bundled table is a decision, not an oversight (see **U-3** in [`RESEARCH.md`](./RESEARCH.md)).

| Authority | For | Verdict |
|---|---|---|
| **FPbase** spectra viewer | Fluorochrome excitation/emission spectra | **Used as the authority, deliberately not bundled**: spectra are instrument- and configuration-dependent, so a shipped table would be wrong for most users' hardware |
| **HCDM** | CD antigen nomenclature | **Used as the authority**: marker names come from the file's `$PnS`, never from a local map |
| **NIST** atomic weights and isotopic compositions | CyTOF isotope masses and abundances | **Used as the authority**: no isotope table is embedded in this repo today, and none should be added without a `@@@constant` header and a per-record test |
| **FlowRepository** · **ImmPort** · **Cytobank** public experiments | Real datasets | **Context**: the intended source for the licensed real-file fixture (**V-3**). Licence must be checked per dataset before anything is committed |
