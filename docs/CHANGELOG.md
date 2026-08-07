# joeee: changelog

The single, human-readable log of **big work** across the repo (shipped capabilities, major
migrations, structural moves), newest first, each stamped with the date it landed.

**This logs a capability STARTING and a capability FINISHING** ([`CLAUDE.md`](../CLAUDE.md)
§9). Add a dated line when work on a capability **begins**, tagged `(started)`, so the log
shows what is in flight and not only what landed, and again when it is **done**, tagged
`(done)`. **Not a line per edit or per session.** Everything else (how it works, what you
could not do and why, the gotchas, the oracles, the remaining TODOs) lives in the **owning
doc**, which is updated like memory: every session that changes anything.
[`TODO.md`](./TODO.md) tracks what is still open.

**Entry shape:**

```
- YYYY-MM-DD: **(started)** **(done)** **<one-sentence headline in bold>.** Owning doc:
  [`X.md`](./X.md). <what it is, and what it now does>. **Gates:** <what ran, with real
  numbers>. **NOT run:** <what did not, and what it would have covered>. **Left open with its
  reason:** <deferrals, each citing which rule permits it>. Sources, including what was ruled
  out: [`SOURCES.md`](./SOURCES.md).
```

The closing clauses are not decoration. `**NOT run**` is how "unverified" stays visible
instead of decaying into "verified", and `**Left open with its reason**` is how a deliberate
absence stays distinguishable from an oversight (`CLAUDE.md` §9, document the negative).

---

- 2026-08-07: **(started)** **(done)** **Governance system: `CLAUDE.md` / `AGENTS.md`, four
  registers, and the doc conventions.** Owning doc: [`README.md`](./README.md) (the docs
  index). Added the repo-wide agent rules (§0 orientation through §11 the wiring contract),
  the owning-doc convention, and the four registers ([`RESEARCH.md`](./RESEARCH.md),
  [`SOURCES.md`](./SOURCES.md), this file, [`TODO.md`](./TODO.md)), ported from the sibling
  bioinformatics repo and retuned end to end for cytometry: FCS/Gating-ML/ISAC authorities,
  the Bioconductor-first source ladder, and the GPL clean-room ledger promoted from prose to a
  blocking merge gate. Every existing doc gained an owning-doc header, and the factual drift
  they carried was corrected in the same pass (see below). **Registered, not faked:** 20 rows
  in `RESEARCH.md` compiled from the open items already written in `ENGINE.md`, `ADVANCED.md`,
  `VALIDATION.md`, and `ROADMAP.md`, plus a code audit. **Gates:** `bun test` 621 pass / 3
  skip / 624 tests across 60 files / 69,042 assertions. **NOT run:** no browser or GPU pass
  (no runtime code changed); `cargo test` and `build:wasm` (no Rust touched). Sources,
  including what was ruled out and why: [`SOURCES.md`](./SOURCES.md).

- 2026-08-07: **(done)** **`typecheck` made runnable, and `app-react` brought under it.**
  Owning doc: [`DEVELOPMENT.md`](./DEVELOPMENT.md). `bun run typecheck` is the gate CI runs and
  three docs called "clean", but **`typescript` was declared nowhere in the repo and was absent
  from `bun.lock`**, so `tsc` could not execute at all: the CI step had been failing rather
  than passing. Added `typescript` to the root devDependencies and added `app-react` (which
  `tsconfig.base.json` excluded, so neither the root typecheck nor CI ever checked the UI) as
  its own typecheck step. A rule about the engine/UI import boundary is worthless if the UI is
  not typechecked. **Gates:** see the entry above.

- 2026-08-07: **(done)** **Doc drift corrected.** The test count was claimed as 73
  (`DEVELOPMENT.md`), ~590 (`README.md`), and 600+ (`CROSS_REPO_LIBRARY_CATALOG.md`); it is now
  measured in exactly one place ([`README.md`](./README.md)) and the others point at the
  command. `VALIDATION.md` named a generator script that does not exist
  (`gen_logicle_golden.py`; it is `gen_golden.py`). `ARCHITECTURE.md`'s layer diagram still
  showed `app-web` as the app layer. The root `README.md` listed spectral clustering and Isomap
  as open after they shipped. `.gitignore` allowlisted a `packages/fcs/test/fixtures/`
  directory that did not exist; the directory now holds a README explaining why the parser
  suite is deliberately fixture-free and what would justify putting a file there (**V-3**).
  `*.stackdump` is now ignored.

- 2026-08-07: **(done)** **Leiden, spectral clustering, Isomap, proliferation modeling,
  density-dependent downsampling, spillover validation, worker-RPC rewrite, FCS allocation.**
  Owning docs: [`ADVANCED.md`](./ADVANCED.md) (§B, §C, §D), [`ENGINE.md`](./ENGINE.md).
  Reconstructed from commit `e9fd030`, which landed all of it plus the 367-line
  [`CROSS_REPO_LIBRARY_CATALOG.md`](./CROSS_REPO_LIBRARY_CATALOG.md) under the message "okay".
  **Recorded here as the counter-example for `CLAUDE.md` §7:** 35 files and 2,376 insertions in
  one untitled commit is unreviewable and unrevertable, and it is why the commit-hygiene rule
  exists. The rest of this history is exemplary and section-tagged; keep that convention.

- 2026-06-15: **(done)** **The React app: pages, menu bar, operations sidebar, plot tabs,
  inspector, console, export.** Owning doc: [`../app-react/README.md`](../app-react/README.md).
  The agnostic-UI wiring over the controller: projects hub with `.fcs` drag-drop, density /
  embedding / heatmap / stats tabs, gate tree, live statistics, workspace JSON and gated CSV
  download. **Left open with its reason:** several operations are wired with hardcoded
  parameters (clustering `k`, downsample size, seed, polygon vertices, and a **fabricated demo
  spillover matrix**). These are `CLAUDE.md` §10 parity gaps and, in the spillover case, a §1
  violation; they are tracked in [`TODO.md`](./TODO.md) §1 and are scaffolding to replace, not
  a pattern to follow.

- 2026-06-15: **(done)** **Clustering and dimensionality reduction exposed as controller
  operations.** Owning doc: [`ADVANCED.md`](./ADVANCED.md) §B, §C.

- 2026-06-14: **(done)** **§L Gating-ML 2.0 import**, with a dependency-free XML parser
  (`engine-controller/interop/`). Owning doc: [`ADVANCED.md`](./ADVANCED.md) §L. Rectangle,
  range, polygon, and ellipsoid gates. **Left open:** FlowJo `.wsp` import, which is a
  different and harder problem (registered as **L-4** in [`RESEARCH.md`](./RESEARCH.md): the
  format is undocumented and the only complete reader is AGPL, so it must be reimplemented from
  observed files).

- 2026-06-14: **(done)** **§I CyTOF (debarcoding, bead normalization, isotope spillover), §G
  ML (logistic regression), §H spatial (neighborhood enrichment), §E differential abundance, §F
  CytoNorm batch correction.** Owning doc: [`ADVANCED.md`](./ADVANCED.md). CytoNorm and FlowSOM
  are **clean-rooms from the publications**; their GPL implementations were deliberately not
  opened ([`LICENSES.md`](./LICENSES.md)).

- 2026-06-14: **(done)** **Advanced clustering and DR: FlowSOM, t-SNE, GMM, UMAP, PhenoGraph,
  Louvain, kNN graph.** Owning doc: [`ADVANCED.md`](./ADVANCED.md) §B, §C. All validated by
  neighbor-preservation / purity / modularity with a fixed seed, **never by exact coordinates**
  (`CLAUDE.md` §2.3).

- 2026-06-13: **(done)** **Oracle validation: compensation and gating geometry, plus
  hyperlog.** Owning doc: [`VALIDATION.md`](./VALIDATION.md). Compensation matches
  `flowutils.compensate` to <1e-6 on an asymmetric 3x3 spillover, **which caught and fixed a
  transpose bug**: the code applied `inv(S)` instead of `inv(Sᵀ)`. Polygon and ellipse gating
  match `points_in_polygon` (winding) and `points_in_ellipsoid` (covariance form) with **zero
  mismatches over ~18k random points**. Hyperlog matches to ~3e-17. This entry is why the
  transpose carries a comment (`CLAUDE.md` §8): deleting it invites the bug back.

- 2026-06-13: **(done)** **The operation catalog** ([`ENGINE.md`](./ENGINE.md) §0 to §8 and
  [`ADVANCED.md`](./ADVANCED.md) tiers A to N) and the master
  [`ROADMAP.md`](./ROADMAP.md). The status marks in those two files are read as claims
  (`CLAUDE.md` §2.9).

- 2026-06-13: **(done)** **The substrate: `EventMatrix` (columnar, SharedArrayBuffer-backed),
  `Population` (packed bitset), the TS/WASM kernel seam, and the logicle transform validated
  against flowutils to ~5e-17.** Owning docs: [`ARCHITECTURE.md`](./ARCHITECTURE.md),
  [`VALIDATION.md`](./VALIDATION.md), [`DERISKING.md`](./DERISKING.md). The keystone decision
  is recorded in `DERISKING.md`: the multi-GB matrix lives in a JS `SharedArrayBuffer`, **not**
  the WASM heap, because wasm32 has a 4 GB address ceiling and Memory64 is still absent from
  Safari. Everything else follows from it.
