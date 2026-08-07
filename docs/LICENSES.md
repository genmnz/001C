# Per-feature license ledger

**Owning doc for port provenance across the whole repo.** The rule that makes it binding is
[`CLAUDE.md`](../CLAUDE.md) §2.6.

> ## The gate: no row, not merged
>
> **A new algorithm module is not done until it has a row in the table below, added in the
> same change.** The row names the module, the algorithm, the reference or port source, that
> source's license, and how it was obtained (`port` / `reimpl` / `clean-room`).
>
> This is the easiest rule in the repo to skip and the most expensive one to skip. Nothing
> automated checks it today ([`TODO.md`](./TODO.md) §6), so it holds only if you hold it.
>
> **And the clean-room is a real constraint, not a formality:** for anything in the queue at
> the bottom of this file, **do not open the implementation.** Not to "check a detail", not to
> "see how they handle the edge case". Reading it contaminates the clean-room and the
> resulting code is a derivative work regardless of how it was typed. Work from the paper.

The discipline (from the Operation Catalog): **permissive** sources (BSD/MIT/
Artistic-2.0) may be ported with attribution; **copyleft** sources (GPL/AGPL)
must be **clean-roomed from the paper/spec — never paste code**, with the DOI
recorded here. If a permissive equivalent appears, switch to it.

**The logicle patent is real and separate from licensing.** Stanford holds patents from 2005
(Parks, Roederer & Moore; US 6,954,722). The reference code is BSD-licensed and the transform
is in Gating-ML 2.0, and Stanford has stated it will not assert in the field of flow cytometry.
The repo-root [`NOTICE`](../NOTICE) records this. Do not remove or weaken it, and do not extend
logicle code into a non-cytometry product without independent legal review.

| joeee module | Algorithm | Reference / port source | License of source | How |
|---|---|---|---|---|
| transforms/logicle | logicle/biexponential | flowutils `_logicle.c` (Moore-Parks) | BSD-3 (Stanford notice) | port + patent NOTICE |
| transforms/hyperlog | hyperlog | flowutils hyperlog; Bagwell 2005 (doi:10.1002/cyto.a.20114) | BSD-3 / Gating-ML | port |
| transforms/{asinh,log,linear,quantile} | closed-form scales | FlowKit transforms.py; GatingML 2.0 | BSD-3 | port |
| transforms/estimateLogicle | auto-W from negatives | flowCore `estimateLogicle` | Artistic-2.0 | clean impl of published formula |
| compensation/apply,invert | spillover un-mix | flowutils `compensate` | BSD-3 | port (oracle-validated) |
| compensation/spillover | spillover from controls | flowCore `spillover()` | Artistic-2.0 | reimpl (median per control) |
| compensation/unmix | spectral OLS/WLS/NNLS | Novo et al. PMC4177998 | paper | reimpl (normal eqns + Lawson-Hanson NNLS) |
| gating/* | rect/poly/ellipse/quadrant/range/boolean | FlowKit `_gate.py`; GatingML 2.0 | BSD-3 | port (oracle-validated) |
| cleaning/* | margin/singlet/debris/saturation/time | flowCore boundary; openCyto gate_singlet | Artistic-2.0 / AGPL→reimpl | reimpl |
| stats/* | counts/MFI/percentile/CV/MAD; diversity; Mann-Whitney | FlowKit/flowCore; Spectre | BSD-3/MIT | reimpl |
| density/{histogram,contour,hexbin} | binning + marching squares + hex bins | d3-contour algorithm (public) | ISC/BSD | reimpl |
| reduce/pca | PCA (Jacobi eigen) | standard | — | own |
| cluster/kmeans | Lloyd + k-means++ | standard | — | own (Rust mirror) |
| autogate/threshold1d | Otsu + density valley (mindensity) | openCyto gate_mindensity; flowDensity deGate | AGPL→clean-room / Artistic-2.0 | reimpl from paper |
| sample/{concat,downsample} | merge + reservoir/uniform sampling | Spectre do.subsample | MIT | reimpl |
| fcs/{parse,write} | FCS 2.0/3.0/3.1 I/O | FlowIO; FCS3.1 spec (doi:10.1002/cyto.a.20825) | BSD-3 | reimpl from spec |
| engine-controller/workspace | analysis doc save/load | own format; Gating-ML 2.0 for import (todo) | — | own |

## Clean-room queue (GPL/AGPL — paper only, never paste)

FlowSOM (GPL≥2, doi:10.1002/cyto.a.22625) · PhenoGraph/Leiden (GPL bundled →
permissive reimpl, doi:10.1038/s41598-019-41695-z) · CytoNorm (GPL≥2,
doi:10.1002/cyto.a.23904) · CATALYST CyTOF (GPL≥2) · PeacoQC (GPL≥3,
doi:10.1002/cyto.a.24501) · flowAI (GPL) · EmbedSOM (GPL-3+,
doi:10.12688/f1000research.21642.2) · PHATE (GPL-2) · openCyto templates /
flowWorkspace / CytoML (AGPL → reimplement Gating-ML 2.0 format only).

Permissive ports to prefer first: flowDensity (Artistic-2.0), flowClust (MIT),
diffcyt (MIT), Spectre (MIT), umap-learn (BSD-3), bhtsne/linfa (MIT/Apache).

**A GPL package may still be used as a golden ORACLE** without contaminating anything: running
it to capture expected outputs is use, not derivation. That is how a clean-room implementation
gets validated (`CLAUDE.md` §2.6). The line is code you read, not a program you run. Record
which side of it you were on in the module header.

Queued clean-rooms with their target modules and oracles are tracked in
[`RESEARCH.md`](./RESEARCH.md) §3.
