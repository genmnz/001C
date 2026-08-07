# CLAUDE.md

Operating manual for agents working in this repo. **These rules override default
behavior. Follow them exactly.** New here? Read [README.md](./README.md) for the repo map and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the shape.

> **`AGENTS.md` is a byte-for-byte COPY of this file, not a symlink.** Some tools read one name
> and some the other. **After editing this file, copy it over:** `cp CLAUDE.md AGENTS.md`. A
> stale copy means half the agents run on old rules, and nothing will tell you: the sibling
> repo this system came from let its copy drift by 11 KB before anyone noticed.

---

## 0. Orientation: what this repo is (don't grep blindly)

**joeee** is a browser-native, **headless-engine-first** flow / mass / spectral cytometry
workstation: an open-source FlowJo / Cytobank / OMIQ / CytoExploreR / Spectre / CATALYST /
CytoFlow hybrid that runs with no backend. It renders and gates millions of events
interactively and does real statistics on every gate drag.

Every architectural decision follows from one constraint: **GPU for pixels, WASM/TS for math,
columnar for data**, and one hard rule that outranks the rest:

> **The event data never enters UI/framework state.**

A Bun workspace monorepo. Five packages, two apps, one server.

| Area | What it is | Rule |
|---|---|---|
| `packages/cytometry-core/` | `@joeee/cytometry-core`: the headless engine. **Zero runtime dependencies.** `EventMatrix` (columnar, SharedArrayBuffer-backed), `Population` (packed bitset), transforms, compensation, gating, cleaning, stats, density, cluster, reduce, graph, autogate, diff, normalize, cytof, ml, spatial, discovery, multisample, sample, proliferation. | **Never imports a DOM, a canvas, a framework, or a package.** Every numeric kernel with an oracle is golden-validated (§2). |
| `packages/fcs/` | `@joeee/fcs`: defensive FCS 2.0 / 3.0 / 3.1 read + write. Zero dependencies. | Parses hostile files without throwing where it can recover; says exactly what it could not recover where it can't (§10). |
| `packages/engine-controller/` | `@joeee/engine-controller`: **the UI-agnostic seam.** `Store<T>` (a ~30-line observable), `EngineController` (the command surface), `EngineApi` with two backends (`createInProcessBackend` for tests/SSR, `createWorkerBackend` for the app), `protocol.ts` (worker RPC), `workspace.ts`, `interop/gatingml.ts`. | The only thing a UI is allowed to talk to (plus `cytometry-gpu`). §3 |
| `packages/cytometry-gpu/` | `@joeee/cytometry-gpu`: browser-only renderer. WebGPU compute + render, Canvas2D fallback, WGSL shaders, colormaps, logicle-aware axis ticks, pan/zoom. Depends on core so binning math is shared and headlessly testable. | The GPU must produce the **same bins** as `core/density/histogram2d.ts`, which is the source of truth. §3 |
| `packages/cytometry-wasm/` | `joeee-cytometry-wasm`: Rust SIMD mirror of the hot kernels (logicle, gating, compensate, k-means). Raw C ABI over linear memory, **no wasm-bindgen**, so `cargo test` runs offline. | `TsKernels` and `WasmKernels` must be **identical**, asserted in `kernels.wasm.test.ts`. Swapping backends can never change a result. |
| `app-react/` | The real UI: Bun + Vite + React 18, pages / menus / operations / plots. Styling is **inline `CSSProperties` objects**; there is no CSS file and no CSS framework. | Imports `@joeee/engine-controller` and `@joeee/cytometry-gpu`, **never `cytometry-core`**. §3, §4 |
| `app-web/` | **Kept on purpose, not dead scaffolding.** The vanilla-TS reference UI. Its whole job is to prove the central architectural claim: swap React for nothing at all and the engine is unchanged. Its header comment states the contract it demonstrates. | It must keep compiling. If you change the controller surface, update `app-web` too, or the agnosticism claim is a slogan instead of a proof. |
| `server/serve.ts` | Tiny Bun static server that sets COOP/COEP. | Cross-origin isolation is **required** for `SharedArrayBuffer`. Without both headers the matrix silently degrades to per-worker copies. |
| `scripts/golden/gen_golden.py` | The one golden generator, running the real **flowutils** oracle. | The only way goldens are produced. Hand-editing a golden file is forbidden. §2 |

The dependency arrow points one way only, and it is enforced by module structure:

```
app-react / app-web ─▶ engine-controller ─▶ cytometry-core
        │                     │           ╲▶ fcs
        ╰─▶ cytometry-gpu ────────────────▶ cytometry-core
                        (cytometry-wasm mirrors core's hot kernels)
```

**Deep docs: read the one that owns the area instead of reverse-engineering it.** The full map
is [`docs/README.md`](./docs/README.md). The short version: shape and boundaries →
`docs/ARCHITECTURE.md`; day-to-day wiring → `docs/DEVELOPMENT.md`; what the engine can do and
what it can't → `docs/ENGINE.md` (§0 to §8) and `docs/ADVANCED.md` (tiers A to N); oracles and
tolerances → `docs/VALIDATION.md`; port provenance and licensing → `docs/LICENSES.md`; plots
and view modes → `docs/PLOTS.md`; the hard constraints and why → `docs/DERISKING.md`.

**Four registers, four jobs, and none of them is the source of truth for the others:**
[`docs/RESEARCH.md`](./docs/RESEARCH.md) is what must never be invented ·
[`docs/SOURCES.md`](./docs/SOURCES.md) is what was read, including what was rejected ·
[`docs/CHANGELOG.md`](./docs/CHANGELOG.md) is what started and what landed ·
[`docs/TODO.md`](./docs/TODO.md) is what is open.

---

## 1. Data integrity (NO fake/mock data) NEVER

> **The one rule: no stubs, no hardcoded/placeholder values, no unrequested TODOs, ever. Every
> line you ship must be correct, tested, real, and accurate. If you can't do it for real, STOP
> and say so. Never fake it, stub it, hardcode it, or pre-emptively defer it with a TODO we
> did not agree on.**

- **Never fabricate, mock, hardcode, or stub data, fixtures, samples, previews, or placeholder
  content unless the user EXPLICITLY asks for it in that request.** Everything is real and
  production-grade.
- **In cytometry specifically, the values you must never invent** are: a spillover or
  compensation matrix, a fluorochrome spectrum, an isotope mass or purity, a transform
  parameter presented as a default a scientist would recognize, a cofactor, a bead lot value,
  a channel-to-marker mapping, a reference population frequency, a p-value, an FDR, a
  confidence interval, or any statistic. A plausible-looking number in this domain is worse
  than an error, because it will be believed.
- No `FAKE_*`, `MOCK_*`, `dummy`, `lorem`, or sample-object literals standing in for real
  records. If real data isn't available, say so and ask. Do not invent it.

### 1a-pre. The synthetic-data carve-out (read this before you "fix" `synth.ts`)

This repo generates synthetic events **on purpose**, and that is legitimate:

- `packages/fcs/test/synth.ts` is a **spec-correct FCS writer** used so the parser suite is
  self-contained (write → parse → assert) and **no binary fixtures are committed**. This is a
  deliberate design decision, not a shortcut. Do not replace it with checked-in `.fcs` blobs.
- `app-react/src/synth.ts` and `app-web`'s `synthClusters()` generate a demo sample so the app
  is testable without a user's file (`.fcs` files are gitignored: never commit real patient
  data).

The carve-out has **three hard limits**:

1. **Synthetic data must be labelled synthetic in the UI**, at the point a user could mistake
   it for their own. "demo.fcs" in a menu is not a label; the workspace must say it is
   generated.
2. **Synthetic data is never a validation oracle.** A test that asserts our engine against our
   own generator proves the generator and the engine agree, which is not the claim we make
   (§2).
3. **A synthetic *parameter* is not covered by this carve-out.** Generating 80,000 events from
   two Gaussians is honest demo data. Handing `compensate()` an invented 2x2 spillover matrix
   and logging "Compensation applied" is a fabricated scientific result wearing a demo's
   clothes, and it is a §1 violation. **This exists in the code today** (`app-react/src/App.tsx`,
   the `compensate` action) and is registered in [`docs/TODO.md`](./docs/TODO.md); do not copy
   the pattern, and do not add more of it.

## 1a. Research markers (`TODO:RESEARCH` / `@@@research`): the anti-pollution rule

The **escape valve for §1**, so **the agent NEVER pollutes a scientific result.** When a task
needs something you don't have in hand (an algorithm, a model, a coefficient, a parameter
table, a validation oracle, a real dataset) you do **not** invent a constant, guess a formula,
approximate a published method, or ship the wrong path. You **mark it and stop**, and either
resolve it properly or leave the honest proxy. Two markers, one meaning:

- **`TODO:RESEARCH`**: a **well-scoped capability or validation gap** in a doc (the owning
  `docs/**` file): an algorithm to obtain, a paper to clean-room from, an **oracle** needed
  before golden-validation, or data that must come from a modern authoritative source. Large
  or small is fine; it must be specific and accurate, so the reader knows exactly what to find
  and how to prove it.
- **`@@@research`**: the **in-code** variant, tagged right next to the code it taints: a
  specific number, parameter, or formula currently standing on an approximation or a
  placeholder, to be replaced with the real literature value and golden-validated (§2).

**Rules for markers:**

1. **Never fabricate to paper over a gap (§1).** A guessed cofactor, an approximated model
   score, or a made-up spillover value is worse than an honest marker plus a labelled proxy.
2. **Authoritative and modern only.** Resolution comes from a peer-reviewed method, a real
   reference implementation, or a vendor datasheet, never from memory. Then it is
   **golden-validated** (§2) before it ships. Prefer the current best method: this field moves
   (opt-SNE superseded naive t-SNE defaults; Leiden superseded Louvain for the connectivity
   guarantee; spectral panels outgrew fixed-matrix compensation).
3. **Well-scoped.** Each marker names the capability, the source algorithm or authority, the
   target module, and the golden oracle, so any agent can pick it up cold.
4. **Register and monitor.** Every marker is **both** a one-line tag in its owning doc/code
   **and** a row in **[`docs/RESEARCH.md`](./docs/RESEARCH.md)**. Resolving one means: port or
   clean-room it, golden-validate it, delete the tag from the owning file, strike the
   `RESEARCH.md` row. Grep the set with:
   ```bash
   grep -rn "TODO:RESEARCH\|@@@research" --include=*.md --include=*.ts --include=*.rs \
     docs/ packages/ app-react/ scripts/
   ```

### 1b. No embedded domain knowledge

Scientific facts, datasets, identifiers, registries, mappings, reference panels, marker
lists, antibody catalogs, fluorochrome spectra, isotope tables, parameter tables,
coefficients, curated examples, and lookup tables MUST NOT be embedded in source code unless
they are immutable standards (a mathematical constant, the IEEE-754 layout, ASCII, the FCS
keyword grammar itself).

If the information exists in an authoritative external source, the application must obtain it
from that source, or from a versioned dataset whose provenance is documented in the file
header.

**Never maintain our own scientific registry when an authoritative one exists. Authoritative
sources always win.** For this domain:

| Kind of fact | Authority |
|---|---|
| FCS file format (2.0 / 3.0 / 3.1 / 3.2) | **ISAC** standard (FCS 3.1: doi:10.1002/cyto.a.20825) |
| Gate serialization, transform definitions | **Gating-ML 2.0** (ISAC recommendation) |
| Logicle / biexponential | Moore & Parks 2012; Parks, Roederer & Moore 2006 |
| CD antigen nomenclature | **HCDM** (Human Cell Differentiation Molecules) |
| Fluorochrome excitation/emission spectra | **FPbase** spectra viewer; the vendor's own datasheet |
| Reference implementations and oracles | **flowutils / FlowKit / FlowIO** (Python, BSD-3); **Bioconductor** flowCore / flowDensity / CATALYST / diffcyt (R) |
| Real public datasets | **FlowRepository**, **ImmPort**, **Cytobank** public experiments |
| Isotope masses and natural abundances (CyTOF) | **NIST** atomic weights and isotopic compositions |
| Publications | **PubMed / DOI** |

**Never hardcode identifiers.** Do not embed accession numbers, FlowRepository IDs, panel
definitions, or marker-to-channel mappings as lookup conveniences. Resolve them from the
current file's own metadata (`$PnN`, `$PnS`, `$SPILLOVER`) or from the authority.

**No finite allow-lists.** Never implement a capability as "supported instruments", "supported
panels", "supported fluorochromes", "supported markers", or "supported FCS versions" unless
the capability is genuinely limited by the upstream standard. Discover entities from the file.

**Offline caches are implementation details, not sources of truth.** Cached data must preserve
the original identifier, the source authority, the version or release, and the retrieval date,
and must be refreshable from the original source.

**Every big embedded table is marked `@@@constant`.** That marker is the INDEX of this repo's
embedded datasets, so it must be complete and greppable:

```bash
grep -rn "@@@constant" --include=*.ts --include=*.rs --include=*.wgsl packages app-react
```

Each marked table owes three things: a cited source and provenance in its header, a test that
covers **every record** (§2 rule 2), and a cross-check against the authority. A table with none
of those is indistinguishable from invented data no matter how real it started out.

**Before adding a table, grep for it.** A duplicated table is a table that will diverge, and
the day it does, one surface draws a plot from numbers another surface disagrees with. The
live example in this repo: the `VIRIDIS` and `INFERNO` anchor stops in
`packages/cytometry-gpu/src/colormap.ts` are **deliberately duplicated** in the WGSL shader so
CPU and GPU color identically. That duplication is correct and load-bearing, which is exactly
why it owes a test asserting the two copies agree. Add a copy only with a stated reason it
cannot be derived from the existing one, plus a test tying them together.

### 1c. Research discipline (mandatory web sweep before implementation)

**Research before architecture. Do not design or implement from memory.** When implementing,
extending, validating, or replacing any scientific, algorithmic, or technical capability whose
correctness depends on external knowledge, perform a comprehensive research sweep **BEFORE**
writing code: enough to understand the capability, its complete feature surface, authoritative
data sources, upstream implementations, common workflows, and current best practices.
**Architecture should emerge from the research rather than constrain it.**

**Research is mandatory whenever:**
- the user explicitly asks to search, research, look up, or sweep;
- a capability feels incomplete, underspecified, outdated, suspicious, or based on memory;
- authoritative datasets, algorithms, standards, APIs, coefficients, parameter tables,
  reference implementations, or publications may exist;
- a `TODO:RESEARCH` or `@@@research` marker is encountered (§1a);
- a capability will become a scientific source of truth inside the application.

**The goal is not to find one answer, it is to understand the capability.** A sweep covers,
where applicable: authoritative documentation · reference implementations · upstream source
code · academic literature · standards and specifications · vendor documentation · maintained
datasets · competing implementations · current best practices · known limitations and edge
cases.

**Research continues until diminishing returns.** Do not stop searching because one
implementation works, and never stop after the first implementation if the capability appears
larger than it first seems. The implementation should represent the **complete capability
surface**, not merely the first solution discovered.

**Sweep AGGRESSIVELY, and name what the sweep ruled OUT.** A sweep that reports only what it
chose is unreviewable: the reader cannot tell a considered rejection from an oversight.
Record, in the port header or the owning doc, what exists, what was rejected **and why**
(different definition, unmaintained, wrong licence, no oracle), and **which name-collisions to
avoid**. In this domain the collisions are real and expensive:

- **"FCS"** is also Free Cash Flow, Fedora Container Signing, and a font format. Search for
  "Flow Cytometry Standard" or the ISAC DOI.
- **"FlowKit"** is a Python cytometry library (BSD-3, the source of our oracle) **and** an
  unrelated Swift FCS/Gating-ML implementation (`xwu/FlowKit`) **and** several unrelated
  workflow packages. Name the one you mean.
- **"Spectre"** is an MIT-licensed cytometry R toolkit and also a CPU vulnerability, a game
  engine, and a build tool.
- **"logicle"** returns almost nothing useful; search Moore & Parks or "biexponential display".
- **npm's cytometry packages are mostly abandoned toys.** `MorganConrad/fcs` is the only JS
  parser of note and has no gating. **Never grade a package by download count.**

**WRITE DOWN EVERY SOURCE YOU FETCHED.** A URL you read and did not record is a sweep nobody
can re-run. The reasoning that made you pick a source leaves an artifact (the code); the
*fetching* leaves none, so the next agent re-searches from scratch, lands on a different page,
and silently re-derives the capability from a worse source. **Minimally:**

- Every URL you actually opened during a sweep gets a row in
  **[`docs/SOURCES.md`](./docs/SOURCES.md)**: the URL, one clause on what it IS, whether it was
  **Used** or **Ruled out**, and the owning doc. Rejections are the half that pays.
- The two or three the code actually stands on are ALSO cited in the module header or the
  owning doc, next to what they justify. The register is the index; the header is the
  provenance.
- **Cite the durable page, not the search.** A specification, a reference implementation's
  source file at a path, a release note, a datasheet. Never a search-results URL. Where a spec
  exists only as a paywalled PDF, say so in the row, because that is exactly the fact the next
  reader needs before spending the fetch.

**A gap you register as blocked is a CLAIM, and it must be re-tested before you rely on it.**
Write the premise down ("no runnable oracle exists for this on this platform"), because a
premise stated is a premise someone can falsify. When picking work up, re-check the premise of
anything marked blocked before treating it as settled.

**Never conclude a sweep merely because an implementation compiles or passes tests.** It is
complete only when you have reasonable confidence that no major capability, algorithm, dataset,
workflow, or authoritative source has been overlooked.

**Assume documentation is incomplete.** This repo's own docs, READMEs, and comments are **not**
authoritative descriptions of a capability. Cross-check them against upstream implementations,
standards, and current literature before assuming a capability is complete. Three docs in this
repo disagreed with each other about the test count until 2026-08-07.

---

## 2. Porting, goldens, and the license gate

This is the standing rule the user should never have to restate. It has three halves that all
have to hold: the port is **faithful**, the output is **golden-validated**, and the source is
**licensed and recorded**.

### 2.1 Faithful, not transliterated

Reproduce the source's *semantics, algorithms, and performance strategies* (automata, indices,
memoization, graph algorithms, typed-array ops) in idiomatic TypeScript or Rust. Never drop a
trick because it "looks like an internal"; re-implement it. Never knowingly ship the slower
path when a faster one exists in any source. Reproduce upstream **bugs** faithfully when they
affect observable output, and comment them.

**Numeric precision is part of faithfulness here.** Logicle root-finding and matrix inversion
accumulate visible f32 error, which is why they are f64 (`logicle.ts`, `invert.ts`) even though
the event columns are f32. Do not "optimize" a precision choice without an oracle run proving
the result is unchanged.

### 2.2 Validated against golden vectors, COVERING the data, never SAMPLING it

Outputs are captured by running the **real** source library and asserted against it in tests.
**No golden validation, not done. No exceptions.**

- The oracle is **flowutils** (FlowKit's C extensions, derived from the Moore-Parks Stanford
  reference), pinned at the version in `scripts/golden/requirements.txt`.
- Generated **only** by `scripts/golden/gen_golden.py` into
  `packages/cytometry-core/test/golden/*.golden.json` plus
  `packages/cytometry-wasm/tests/logicle_golden.csv`.
- Every golden file carries a `provenance` block naming the oracle, its version, numpy's
  version, and the generator. **Preserve it.** A golden without provenance is a number nobody
  can re-derive.
- **Hand-editing a golden file is forbidden.** If a golden disagrees with the code, the golden
  is right and the code is wrong, until an oracle run says otherwise. `gating.golden.json` is
  1.6 MB; do not reformat it casually, and never let an editor rewrite its whitespace.
- Regenerating requires the venv (see `docs/VALIDATION.md`). If you cannot run it, **say so**
  rather than adjusting an expectation to match your output.

**When the thing under test is a DATASET or a parameter space, the golden covers EVERY member,
not a curated list.** A hand-picked list in a generator is the smell. If a transform has five
parameter cases, the golden asserts all five; if the engine ships N gate shapes, the golden
covers N. **Assert the exact accounting too**: how many were checked, how many skipped and
why. `expect(n).toBeGreaterThan(150)` hides the same hole a second time. This is not
hypothetical: in the sibling repo an enzyme table was validated over 24 hand-picked entries out
of ~250, and a blunt-vs-sticky error shipped for months under a fully green suite.

**Cover the edges, not the middle:** negatives, exact zero, values below the linearization
width, values above `T` (the over-range case that exercises the root-finder's bracket
extension), NaN, empty populations, single-event populations, and a gate that contains
everything or nothing.

### 2.3 Stochastic methods are validated by structure, never by coordinates

t-SNE, UMAP, MDS, Isomap, FlowSOM, GMM, PhenoGraph, Louvain, Leiden, DBSCAN, spectral and
consensus clustering are validated by **neighbor-preservation, cluster purity, modularity, ARI,
or EMD with a fixed seed**, never by exact output coordinates. The repo already does this and
the rule exists so nobody "strengthens" it into an exact-match test that is flaky by
construction. If you need tighter confidence, add an invariant (a bound, a monotonicity, a
conservation law), not a coordinate.

### 2.4 A COMPOSITION IS A NEW CAPABILITY, AND IT OWES ITS OWN GOLDEN

Validated parts do **not** add up to a validated whole. The moment you combine
golden-validated engines into an output no single one of them produces, **you have built a new
capability, and it is unvalidated until it has a golden of its own.** In this repo that means,
concretely:

- the **pipeline** compensate → transform → gate → stats, run end to end on one sample;
- a **batch** over N samples (cohort aggregation, cross-sample matching, CytoNorm to a goal);
- an **aggregate** (a cluster x marker enrichment matrix, a differential-abundance table, a
  "run every clustering method and compare" report);
- any **coordinate bookkeeping between calls** (display space vs data space vs screen space,
  which is where gate geometry bugs live).

The parts' goldens cover the parts. Nothing covers the *assembly*, and that seam is invisible
under a fully green suite because every underlying test still passes.

**Get the oracle for the COMPOSITE, not just the parts.** First look for a real upstream that
produces the same *combined* output (flowCore + flowWorkspace produce gated counts for a whole
file; FlowKit runs a whole GatingStrategy) and golden against that. Running the single-item
program N times is not a substitute. When no upstream composite exists, the golden is the
**equivalence assertion**: the batch over N must equal N single runs; a multi-step product must
equal the sequence of single steps. **State which of the two you used.**

**This is also the rule that decides WHERE composite logic lives.** If it needs a golden, it
belongs in `cytometry-core` or `engine-controller` under the golden discipline, not assembled
ad hoc in a React component where nothing will ever check it. "It only calls validated code" is
the argument that ships an unvalidated capability.

### 2.5 The source ladder: walk it in order, and WRITE DOWN where it bottomed out

For each layer of a capability, in this order:

1. **A maintained npm package** that already does it. Rare in this domain and usually wrong;
   check anyway, and record the rejection.
2. **A JS/TS or Python OSS repo**, small enough to read end to end: **FlowKit, flowutils,
   FlowIO** (BSD-3, and the source of our oracle), **Spectre** (MIT). Clone and port.
3. **R via Bioconductor / CRAN.** In cytometry this is not a fallback, it is where the field
   actually lives: **flowCore**, **flowDensity**, **flowClust**, **CATALYST**, **diffcyt**,
   **openCyto**, **flowWorkspace**, **CytoML**, **FlowSOM**, **CytoNorm**, **PeacoQC**.
   `Rscript` plus `install.packages`/`BiocManager` is a genuine, runnable golden oracle.
   **Check Bioconductor before declaring "no oracle exists".**
4. **C/C++** last, and even then **the C does not ship**: it is compiled only to GENERATE
   goldens.

**Picking a lower rung for convenience is a bug.** A higher rung whose *definition differs* is
not a shortcut, it is a wrong answer. And a definition difference in this field is easy to
miss: "MFI" means the median in one tool and the geometric mean in another; "percent positive"
depends on where the negative gate came from. If the oracle's definition differs from ours,
either adopt theirs or document the divergence explicitly (§2.7).

**Before declaring a C-only algorithm unreachable, check whether its function is
self-contained.** A function that touches only its own arguments can be extracted verbatim and
compiled with a small `gcc` harness: no full library build required. Locate it by its exact
signature so a reformat upstream fails loudly rather than silently copying the wrong lines.

**KEEP THE CLONE. Goldens must stay regenerable.** A golden is only regenerable if the source
that produced it is still runnable. Keep the oracle environment (the venv, the R library, the
clone) and document how to rebuild it in `docs/VALIDATION.md`. A golden nobody can reproduce is
a number of unknown origin.

### 2.6 The license gate: BLOCKING, and the highest-risk rule in this repo

Cytometry's best implementations are overwhelmingly R/Bioconductor and frequently **GPL**. The
discipline is in [`docs/LICENSES.md`](./docs/LICENSES.md) and it is not optional:

- **Permissive sources** (BSD / MIT / Apache / Artistic-2.0) may be **ported with attribution**.
- **Copyleft sources** (GPL / AGPL) must be **clean-roomed from the paper or the spec. Never
  paste code, never paraphrase code you have open.** Record the DOI.
- **A new algorithm module is not done until it has a row in `docs/LICENSES.md`, added in the
  same change.** The row names: the module, the algorithm, the reference or port source, that
  source's license, and how (`port` / `reimpl` / `clean-room`). No row, not merged. This is the
  single easiest rule in the repo to skip and the most expensive one to skip.
- The **clean-room queue** at the bottom of `LICENSES.md` is the list of things that may only
  ever be built from the paper. Read it before you open a repository.
- **The logicle patent is real** (Stanford, US 6,954,722). `NOTICE` at the repo root records
  the field-of-use position. Do not remove or weaken `NOTICE`, and do not extend logicle code
  into a non-cytometry product without saying so.

### 2.7 Cross-validated against the AUTHORITY, and against its own duplicates

A ported table or constant is a local copy, and §1b's authority outranks it, **including
outranking the upstream repo we ported from**. When upstream disagrees with the authority,
correct it and **pin BOTH values** (the one adopted and the one left behind), so neither a
silent revert nor a further drift can pass. If the same data exists in more than one shape (as
the colormaps do, in TS and WGSL), a test asserts they agree with each other.

### 2.8 Merged, not duplicated

One capability lives in **one** action-named place; fold other sources' extras in as parameters
or helpers. Cite the source file(s) and the merge rationale in a top-of-file comment. When you
consolidate two existing implementations of the same thing, the merge is best-of-both: a single
superset module, no lossy pick-one, no dead duplicate left behind, and it is **done only when
BOTH sides' existing tests stay green.** Never drop an old test.

### 2.9 Status reported honestly

`[x]` = done in full; `[~]` = partial, naming exactly what is deferred and why; `[ ]` = todo.
Never inflate. `docs/ENGINE.md` and `docs/ADVANCED.md` use these marks and they are read as
claims.

---

## 3. The engine / UI boundary

This is the invariant the whole architecture exists to protect. It was prose in
`ARCHITECTURE.md` for months with nothing enforcing it. Treat every line below as a hard rule.

- **The event data never enters UI/framework state.** A million-row array in React/Solid/Svelte
  reactive state kills interactivity. `EventMatrix` and `Population` bitsets live in the engine
  and, in the browser, in a Web Worker behind a `SharedArrayBuffer`. Only **view state**
  (sample and channel metadata, gate geometry, axis selections, computed numbers) lives in the
  store the UI subscribes to. Even derived render payloads (density bins) are **returned to the
  renderer**, not stored.
- **UI code must NEVER import `@joeee/cytometry-core`, and must never touch an `EventMatrix`.**
  The UI depends on `@joeee/engine-controller` (plus `@joeee/cytometry-gpu` for the canvas).
  If you need something from core in the UI, that is a signal the **controller** is missing a
  command, not a signal to reach through.
- **`cytometry-core` must NEVER import a DOM type, a canvas, a framework, or any runtime
  dependency.** It has zero dependencies on purpose: that is what makes `bun test` run with no
  network and what keeps the engine testable headlessly.
- **`density/histogram2d.ts` is the source of truth.** The WGSL compute pass mirrors it
  bin-for-bin, and a parity test asserts GPU bins equal CPU bins. If they disagree, the GPU is
  wrong.
- **`TsKernels` and `WasmKernels` must be identical.** `loadWasmKernels` falls back to TS when
  the `.wasm` is missing, so results must not depend on which one ran.
  `kernels.wasm.test.ts` asserts this and **skips when the artifact is not built**, which means
  a local green run does not prove parity. CI builds the wasm first, precisely so the test does
  not silently skip.
- **Gates operate in display space** (the transformed coordinates the user drew on), not raw
  data space. Getting this backwards produces gates that look right and count wrong.
- **Cross-origin isolation is load-bearing.** `Cross-Origin-Opener-Policy: same-origin` plus
  `Cross-Origin-Embedder-Policy: require-corp` must both be present or `SharedArrayBuffer` is
  unavailable and the matrix degrades to per-worker copies. Dev: `app-react/vite.config.ts`.
  Prod: `server/serve.ts`. Runtime check: `isCrossOriginIsolated()`. Any cross-origin asset
  must send CORP or COEP blocks it, which is one more reason this app has no CDN dependencies.
- **When you change the controller surface, update BOTH apps.** `app-web` exists to prove the
  UI is swappable (§0). A controller change that only `app-react` picks up quietly turns that
  proof into a claim.

---

## 4. Rendering, colormaps, and UI style

- **The colormap anchors live in `packages/cytometry-gpu/src/colormap.ts` and are mirrored in
  WGSL on purpose**, so CPU and GPU color identically. Change one, change the other in the same
  pass, and keep the test that asserts they agree. Do not add a third copy.
- **Do not add a charting library for the event cloud.** deck.gl, regl, Plotly, and Chart.js
  are all WebGL/DOM-era and CPU-bound at this scale; `docs/PLOTS.md` records the decision and
  the reasoning. D3 is used as a toolkit (`d3-contour`, `d3-scale`, `d3-axis`), never as the
  renderer. Logicle-aware ticks are ours because no library places them correctly.
- **`app-react` styles with inline `CSSProperties` objects. There is no CSS file, no CSS
  framework, and no design-token system.** Match what is there: a style constant next to the
  component that uses it. **Do not introduce Tailwind, CSS modules, styled-components, or a
  theme system as a side effect of another change.** If the app needs one, that is its own
  decision, made deliberately and written down, not smuggled in.
- **Raw color values are acceptable** in canvas, WGSL, and colormap contexts, which is most of
  this app. There is no token layer to violate.
- **Never fail silently in the UI.** An input the app cannot process must SAY what is wrong,
  why, and what to do instead. An empty plot, a dead button, or a no-op run is a bug, and "no
  output" must never be how a user discovers their file was invalid (§10). The console panel is
  a log, not an error channel.

---

## 5. Verify and report honestly

- **Bun is the ONLY package manager and script runner. Never `npm`, `npx`, `yarn`, or `pnpm`.**
  Use `bun install`, `bun run <script>`, `bunx <binary>`, `bun test`. This is a Bun workspace
  (`bun.lock`): npm and npx resolve differently and can rewrite the lockfile.
- **The gates, in the order you should reach for them:**

  | Gate | Command | When |
  |---|---|---|
  | Scoped tests | `bun test <path>` or `bun test -t <name>` | after every change: this is the default gate |
  | Full suite | `bun test` | before calling something done |
  | Typecheck | `bun run typecheck` | once, near the end, for possibly-breaking edits |
  | Rust | `bun run test:wasm` (`cargo test`) | only when Rust source changed |
  | WASM parity | `bun run build:wasm` then `bun test` | when kernels changed: otherwise the parity test SKIPS |

- **There is NO linter and NO formatter in this repo.** No Biome, no ESLint, no Prettier, no
  editorconfig. Do not invent a lint gate, do not claim one ran, and do not add one as a side
  effect of another change. Formatting is by local convention: match the file you are in.
- **`tsc --noEmit` is slow. At most one typecheck per session, at the end, and only for
  possibly-breaking edits** (new or changed signatures, moved or renamed exports, refactors
  across files, generics, engine-to-UI type contracts). Not after each edit, not mid-task, and
  not at all for a comment, a doc, or a one-line tweak inside an existing signature. **Skipping
  it is the better outcome when in doubt:** scoped tests are the gate, and honestly saying "no
  typecheck run" beats spending the session waiting on `tsc`.
- **Never run a production build (`bun run build:web`, `vite build`) as a verification step, and
  never build unprompted.** Only build when the user explicitly asks.
- **Report the real result.** If tests fail, say so with the output. If you skipped a gate, say
  which and why. Don't claim "done" or "verified" for something you only assume. **Everything
  you report about what you did NOT do (a skipped gate, a rejected design, scope left on the
  floor) goes in the owning doc as well as in the reply (§9). Both, every time.**
- **The GPU path has no CI coverage.** There is no GPU in CI and the WebGPU test page is manual.
  Any change to `cytometry-gpu`'s render path is **unverified** until a human looks at it. Say
  so; do not let "tests pass" imply the pixels are right.
- **Never drive a browser unless the user asks for it in that session.** No browser automation
  on your own initiative. If a change wants visual QA, say so and let the user call for it.
- **Reuse the running dev server.** `bun run web` wants one Vite port; if it is taken Vite
  silently bumps to the next one, so starting a fresh server each task leaves several copies
  running, all watching the same files. Check whether one is up and reuse it; if it is stale,
  restart **that** one instead of launching another.

---

## 6. Agents / exploration

- **Do not spawn agents (including Explore/search agents) unless the user explicitly asks.** Do
  exploration yourself with the normal file and search tools.

---

## 7. Git and workflow

- **Never create git branches or worktrees unless explicitly told to.** Work on the currently
  checked-out branch (default: `main`). Do not run `git checkout -b`, `git branch`, or
  `git worktree add` on your own initiative. Commit and push only when asked.
- **Commit messages describe the capability, and this repo has a convention worth keeping:**
  a short imperative summary, tagged with the catalog section where one applies
  (`§L Gating-ML 2.0 import (dependency-free XML parser + reader)`,
  `§I CyTOF (debarcode + bead-norm), §G ML (logistic), §H spatial (neighborhood)`). Those tags
  tie a commit to `docs/ENGINE.md` and `docs/ADVANCED.md`, which is how the history stays
  readable.
- **One commit, one capability.** A 35-file dump titled "okay" is unreviewable and unrevertable,
  and there is one in this history (`e9fd030`, 2,376 insertions spanning Leiden, spectral
  clustering, Isomap, proliferation, spillover validation, a worker-RPC rewrite, FCS allocation,
  and a 367-line new doc). It is the counter-example, not the pattern.
- **Check `git status` before you start writing.** More than one session has worked in this repo
  concurrently; a dirty tree you did not make is a reason to stop and ask, not to commit over.
- **Never commit real FCS data.** `*.fcs` is gitignored for a reason: these files carry patient
  data. Tests generate FCS via `packages/fcs/test/synth.ts` instead.

---

## 8. Editing efficiency and the comment budget

- When you have multiple edits to the **same file**, batch them into one message rather than
  drip-feeding one edit per turn.
- **Comments: same informative content, but ONE-LINERS.** Keep the *why* (the non-obvious
  reason, the gotcha, the source citation), just say it in a single line. Match the surrounding
  code's comment density; terse and informative beats verbose.
- **BUDGET THE COMMENT TO THE DIFFICULTY, and spend it where the difficulty IS.** The failure
  is not "too many comments", it is comments allocated backwards: an eight-line JSDoc narrating
  a component whose name already says everything, while the genuinely hard thing two files over
  carries nothing. **The obvious gets one line or none; the hard thing gets the paragraph it
  needs.** Before writing a block, ask whether a competent reader would be *wrong* without it.
  If not, delete it. If yes, that is exactly where the length is earned.
- **Where the length IS earned in this repo**, and where it is usually missing:
  - **Precision choices**: why logicle root-finding and matrix inversion are f64 while the
    columns are f32.
  - **The transpose**: `inv(Sᵀ)` and not `inv(S)`. This was a real bug the compensation oracle
    caught. The comment is what stops it coming back.
  - **Coordinate conventions**: data space vs display space vs screen space, and which one a
    given gate geometry is in.
  - **Bitset word-wise operations** and why the loop is shaped the way it is.
  - **The SAB and COOP/COEP coupling**: why a header on a server makes a data structure work.
  - **The wasm32 4 GB ceiling** and why the matrix is in a JS `SharedArrayBuffer`, not the WASM
    heap. This is the keystone decision of the whole project.
  - **A faithfully reproduced upstream bug**, with the citation.
  - **A fix whose deletion would silently reintroduce a bug**: leave the counter-example (§10).
- **Never pad to a shape.** No boilerplate `@param`/`@returns` when the types carry it, no
  ceremonial header on every export, no restating the function name as a sentence.
- **When editing, leave it better:** if you touch a function wearing a bloated header, compress
  it in the same pass; if you touch genuinely subtle code that explains nothing, that is where
  you add the comment. This rebalancing is not scope creep, it is the rule.

---

## 9. Docs: layout, the doc-loop, hygiene

**Layout: all docs live in `/docs`.** The ONLY markdown allowed outside a `docs/` directory is:
`README.md` files co-located with code, and the root `CLAUDE.md` + `AGENTS.md` (the harness
loads these from the repo root). Never drop a loose `.md` next to code.

**The doc-loop (the fast path: use it).** The docs are a linked graph: each doc points to the
other docs AND to the real files of interest. Given a task: (1) open the doc that owns that
area (the §0 table and `docs/README.md` say which), (2) follow its links to the actual files,
(3) make the edits, (4) if the change makes the doc stale, update the doc in the same pass.
Don't re-grep the monorepo to rediscover what a doc already maps, and **don't spawn a new
top-level doc: extend the owning one.**

**Hygiene.** Old plan/TODO/research markdown may be implemented, half-done, or abandoned.
**Don't delete it and don't update an irrelevant one: flag it** with a top banner
(`> **OUTDATED / SUPERSEDED: historical, do not follow.**` plus what replaced it).

**Write it in the DOC, not the changelog.** Everything you learn or decide goes in the **owning
doc** as you go: what you did and how it works, what you could NOT do and why, what is deferred
(with which §11 reason), what still needs research, what needs a human check (a visual GPU
pass, a by-hand comparison against FlowJo), cautions and gotchas, what is reused vs newly
built, the oracles and how to regenerate them, and the remaining TODOs. **That is the record.**
A change is documented when the owning doc reads correctly for someone arriving cold, not when
a changelog line exists.

**DOCUMENT THE NEGATIVE: why you DID, and equally why you REFRAINED.** Every owning doc records
not just the road taken but the roads **deliberately not** taken, and this is the half that is
always missing, because the reasoning that produced a non-action leaves no artifact behind. A
decision you can see in the diff explains itself; a decision to *not* do something is invisible
the moment the session ends, so the next agent re-litigates it, re-proposes the thing you
already rejected for a good reason, or "fixes" the absence and reintroduces the bug. **This is
the single most common way a repo loses knowledge.**

**The bar is: would someone arriving cold be *surprised* by the absence?** If yes it is
load-bearing and it gets written down, in the same pass, next to the thing it is about. "Not
built", "built and then removed for a reason", and "not buildable yet" look identical in a
codebase and mean completely different things. **Name the reason specifically and make it
falsifiable**: not "out of scope", but *which* §11 reason applies, *what* would unblock it, and
*what premise* the deferral rests on, so a later reader can re-test the premise (§1c) instead of
inheriting it as settled fact.

**The hard rule, BOTH, never one instead of the other: say it in chat AND write it in the
owning doc, before the turn ends.** The chat report is the *alert* (the user is deciding what to
do next and must hear it now); the doc is the *record* (the next agent arrives cold and only has
the doc). If it was worth a sentence in chat, it is worth a line in the doc. Equally, writing it
in the doc does **not** discharge the duty to state it plainly in the reply.

Each entry names **what** was not done and **why**, in the doc that owns the area:

- **Rejected alternatives**, with the reason they lose. A rejection with no recorded reason
  reads as an oversight and gets "fixed".
- **Deliberate non-changes**: code you looked at, could have changed, and left alone on purpose.
  Say it next to the thing, where the next reader will be standing.
- **Scope you did NOT take**, and whether it is a §11 deferral, a §1a research gap, or simply
  out of scope.
- **Gates not run**: the typecheck you skipped, the browser/GPU pass nobody made, the oracle
  that would not run on this platform, each with what it would have covered, so "unverified"
  stays visible instead of decaying into "verified".
- **Heuristics or checks removed**, with the counter-example that killed them (§10).
- **Non-technical blockers**, the ones most often left in chat and therefore lost: another
  session was editing the same file, a paper was paywalled, a dataset was not licensed, the user
  redirected mid-task. Write the blocker AND what it blocked.

**The changelog logs a feature STARTING and a feature FINISHING.** Add a dated line to
[`docs/CHANGELOG.md`](./docs/CHANGELOG.md) (`- YYYY-MM-DD: <summary>`, real date, newest first)
when work on a capability **begins**, tagged `(started)`, so the log shows what is in flight and
not only what landed, and again when it is **done**, tagged `(done)`. Not a line per edit or per
session: the detail lives in the owning doc.

**Update the docs like MEMORY: every session that changes anything, and whenever you learn
something.** The owning doc is written as you go, not at the end. If a session touched code, a
doc changed too; a session that ends with stale docs is not finished. **The doc is the record.**
It is correct when someone arriving cold can read it and be right.

---

## 10. Granularity, completeness, and the engine-to-UI parity contract

Three standing product rules. They define what "done" means for any capability:

- **Everything granular, scientific, controllable.** Any capability with operations, settings,
  options, parameters, details, or views must expose them at full granularity: every datum
  shown, every knob adjustable. A cytometrist must be able to inspect, edit, override, or cancel
  anything with a scientific basis or a reasonable preference. In this domain that means, at
  minimum: transform parameters (T, W, M, A, cofactor, per-channel), gate vertices and
  boundaries numerically, the statistic definition (median vs geometric mean vs arithmetic
  mean), percentile choice, bin counts, KDE bandwidth, clustering k and seed and metric, DR
  perplexity / neighbors / min-dist / iterations, downsample size and method, QC thresholds,
  compensation matrix values cell by cell, and the spillover source. **Never a black box, never
  a hidden hardcoded default the user cannot see or change.** The current app hardcodes
  `k = 8`, `downsampleTo: 2000`, `seed: 1`, and the polygon vertices; that is scaffolding to be
  replaced, not a pattern to follow.
- **Headless engine and UI kept at parity.** A feature is a headless engine (pure,
  framework-agnostic: `cytometry-core`, `engine-controller`) driving a **separate** UI. Neither
  side leads: every capability the engine computes has a control or readout in the UI, and every
  UI control maps to a real engine capability. **No dead knobs, no hidden outputs.** Touch one
  side, update the other in the same pass so they never drift. `docs/ENGINE.md` and
  `docs/ADVANCED.md` mark what the engine has; `docs/TODO.md` tracks where the UI has not caught
  up.
- **Ship the WHOLE thing. Never thin, shallow, or a knock-off.** A capability is shipped when it
  is the real, authoritative implementation: the whole algorithm, the whole feature surface, not
  a plausible-looking subset that passes a demo. The three failure shapes, all of which look
  green: a **parameter space** validated over a curated handful (§2.2); an **algorithm**
  transliterated without the upstream's tricks and edge cases (§2.1); a **surface** that renders
  convincingly over invented values (§1). If the real, whole version is not achievable now, ship
  nothing and register the gap (§1a). A thin version is worse than absent, because absent is
  honest and thin is a claim.
- **A capability usually has MORE THAN ONE algorithm, and shipping one of them is thin.** Before
  calling a capability done, ask what the incumbents offer and whether the variants are
  genuinely different questions rather than one algorithm with a flag. Clustering here is the
  worked example: k-means, DBSCAN, FlowSOM, GMM, PhenoGraph, Leiden, spectral, hierarchical, and
  consensus are not nine flavors of the same thing; they answer different questions and none
  subsumes the others. When a suite exists (the Bioconductor cytometry stack, FlowJo's gate
  shapes, EMBOSS-style program families), **enumerate it and say which members you covered**, so
  "not built" is visible next to "built".
- **A CHECK THAT FALSE-ALARMS ON REAL DATA MUST BE DELETED, NOT SHIPPED.** A guard that fires on
  a correct input is worse than no guard: it teaches users to ignore warnings and makes a good
  file look broken. Real FCS files in the wild violate the spec constantly (missing `$PnS`,
  disagreeing offsets, non-standard `$BYTEORD`, `$PnR` narrower than the data, vendor keywords
  everywhere) and the parser is *defensive* by design. Test every heuristic against real files
  before keeping it. **When you delete a heuristic, leave the counter-example behind**, or the
  next person rewrites it.
- **Complete is the FLOOR, not the target.** A capability is done when every operation, option,
  and readout it implies is real, wired, and granular, **not** when it compiles, passes tests, is
  "mostly wired", or demos well. **Half-baked, half-ported, half-wired, or partial is NOT done**,
  and neither is a feature whose engine is complete but whose UI is a stub, or the reverse. When
  judging scope, **more than complete beats barely complete**: ship the operations a working
  cytometrist would reach for next. **No silent partial:** if you can't do it for real, STOP and
  say so (§1), name exactly what is missing (§2.9, `[~]` never inflated to `[x]`), and register
  the gap (§1a).
- **A tool is PART OF THE WORKSPACE, not a panel parked next to it.** Every operation reads the
  live context (active sample, selected population, current axes and transform, existing gates)
  and writes back to it (plot highlight, gate tree, stats, console log). A panel that only talks
  to itself is not integrated, however complete its own UI looks.
- **Context flows BOTH ways, and it must actually land.** Selecting a population and opening an
  operation arrives already scoped to it, AND changing the operation's target highlights that
  population on the plot. Verify the seed lands in the panel's real state: a seeder that sets a
  value the panel then re-defaults is worse than none, because it looks wired and isn't.
- **Validate the target BEFORE the run, and say what will be analysed.** A population a tool
  cannot use (too few events, wrong channel type, no time channel, non-finite values) is caught
  up front with the reason shown next to the control that chose it, never discovered by an empty
  table.

---

## 11. The wiring contract (surfacing a headless capability in the app)

Wiring any engine capability into the app is **done only when it is a fully integrated feature
across every relevant surface**, not a lone button. These rules are durable and override
defaults.

**The path, end to end:** an operation in `cytometry-core` → exposed through `EngineApi` and
`protocol.ts` (both backends: in-process and worker) → a method on `EngineController` that
updates `Store` → surfaced in the UI.

- **Research before architecture (§1c).** Before wiring, sweep every function, operation,
  dataset, and format the feature touches, **and every A-to-B flow it can take**
  (operation-to-operation hand-offs, selection-to-operation, input-to-output, format-to-format),
  until you understand the capability's complete surface. Before "compensation", sweep
  acquisition matrix → single-stain controls → spillover computation → application → spectral
  unmixing → autofluorescence → residual QC, and every option each step exposes.
- **NEVER fake, zero exceptions.** Never fake, mock, stub, sample, hardcode, invent defaults, or
  cut corners on any operation, dataset, or value. Everything is real and engine-driven. A cut
  corner is not "done" (§10).
- **ESSENTIAL before FANCY, and FANCY may be deferred for EXACTLY TWO REASONS.** A complete
  wiring ships **ESSENTIAL** first (every core operation, parameter, format, and flow the
  capability implies) then **FANCY** (convenience and polish: presets, quick actions, previews).
  Ship ESSENTIAL in full; never trade it away for FANCY. **FANCY is work to be DONE, not a wish
  list.** It may be deferred only when:
  1. **It isn't buildable for real: no settled logic.** No authoritative algorithm, model,
     dataset, parameter table, reference implementation, or oracle exists yet (a §1a gap).
     Register it, ship the honest proxy or nothing, and say so.
  2. **ESSENTIAL isn't finished yet**, anywhere in that capability. FANCY queues *behind* the
     last ESSENTIAL item, never *instead of* it.

  **Deferring FANCY for any other reason is a violation: the implementation is incomplete, not
  "shipped."** Not valid: "out of scope", "nice to have", "we can add it later", "the user
  didn't ask", it's fiddly, it's a big UI, or you're low on context. Every deferred item is
  **written down** stating which of the two reasons applies; a deferral note citing neither is
  itself the bug.
- **All possible UI, everywhere it belongs.** Integrate the capability into **every** surface it
  fits: the **menu bar** (`MenuBar.tsx`), the **operations sidebar** (`OperationsPanel.tsx`), the
  relevant **plot tab**, the **inspector** (`GateTree.tsx`, `StatsPanel.tsx`), the **console log**
  (`ConsolePanel.tsx`), and **export**, with the full granular controls of §10.
- **Every operation is undoable and serializable.** This is the obligation most easily forgotten
  here, and both halves are real: a new operation that changes view state must participate in
  `controller.undo()`/`redo()`, and anything that belongs to an analysis must round-trip through
  `exportWorkspace`/`importWorkspace`. A workspace that silently loses an operation on reload is
  a data-loss bug, not a missing nicety. Add the round-trip test in the same change.
- **Both backends, always.** A controller method that works in-process but not through the worker
  RPC (or vice versa) is half-wired. `protocol.ts` and both backends are updated together, and
  the controller test suite covers the operation through the same path the app uses.
- **Engine-to-UI parity (§10).** Every engine capability gets a control or readout; every control
  maps to real engine logic. No dead knobs, no hidden outputs.
- **Gaps the sweep surfaces: two options, never invent.** If the research turns up an ESSENTIAL
  or FANCY thing we lack: **(a)** if the gap is small and the algorithm is published, research
  the real method and **implement plus golden-test it now**; **(b)** if the gap is large (a whole
  engine port or a research project of its own, not merely tedious) write it as a one-line
  `TODO:RESEARCH` in the owning doc, add the `docs/RESEARCH.md` row, and **monitor** it until
  resolved. "Large" means a separate project or no faithful source. A big-but-known build is
  option (a), not a deferral. Never fabricate to paper over a gap (§1).
- **Make it reachable from the projects hub.** A new capability, format, or importer is not done
  until a user can open the app and exercise it without hunting for their own file. Real public
  data (FlowRepository, ImmPort) is the right source; synthetic data is acceptable only under the
  §1a-pre carve-out and only when labelled.
- **Validate and report honestly (§2, §5).** Ported logic stays golden-validated; wired logic is
  tests plus typecheck green before "done". GPU and browser verification is only on the user's
  say-so in that session; flag what needs a look instead of driving a browser to close it out.
- **One integrated workstation, one shared context, never isolated tools.** Build a single
  scientific workbench, not a collection of disconnected utilities. Every capability understands
  and reuses the current context (loaded samples, channels, transforms, gates, populations,
  clustering results, settings, and the outputs of other operations) instead of asking the user
  to re-enter information or keeping its own isolated state. Design every feature end to end:
  every meaningful input, output, workflow, downstream consumer, upstream producer, and
  interaction with existing capabilities. Never stop at "the requested operation works" if the
  surrounding workflow is incomplete. Eliminate duplicated logic, duplicated datasets, duplicated
  state, duplicated scientific knowledge, and duplicated UI. The workspace is one coherent system
  with shared context and shared engines, not dozens of standalone tools living beside each
  other.
