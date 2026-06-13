# Numerical validation

The logicle transform is the correctness keystone: render, gating, and stats all
depend on correct transformed coordinates. We validate it at three levels.

## 1. Self-consistency (no oracle needed)

`packages/cytometry-core/test/logicle.test.ts` asserts:

- **Round-trip** — `unscale(scale(v)) == v` and `scale(unscale(x)) == x`.
- **Monotonicity** — `scale` is strictly increasing across the dynamic range.
- **Analytic anchors** — `B(x1) = 0` (data value 0 sits at the internal
  breakpoint) and `B(1) = T` (top of scale), derived algebraically from the
  Moore & Parks construction.

These catch structural errors but, by themselves, cannot catch a *systematic*
error in the biexponential parameter construction — a wrong `(a,b,c,d,f)` that is
still internally consistent would pass round-trip.

## 2. External oracle (the real gate) ✅

`packages/cytometry-core/test/logicle.golden.test.ts` and
`packages/cytometry-wasm/tests/golden.rs` validate against golden values produced
by **flowutils** — the FlowKit logicle C extension, derived from the Moore &
Parks 2012 Stanford reference implementation. This is a reference the joeee ports
did **not** derive from, so agreement rules out a hidden parameter-construction
bug.

**Result:** the TS port matches flowutils to **~5e-17** (machine precision) on the
classic `T=262144, W=0.5, M=4.5, A=0` case, and to `<1e-9` (forward) / `<1e-6`
(inverse, relative) across all five parameter cases. The Rust port matches across
all 75 rows.

Golden files (committed, so CI needs no Python):

- `packages/cytometry-core/test/golden/logicle.golden.json` — forward + inverse,
  with `provenance` recording the oracle and version.
- `packages/cytometry-wasm/tests/logicle_golden.csv` — forward rows for Rust.

### Regenerating the golden values

```bash
python3 -m venv .venv-golden && . .venv-golden/bin/activate
pip install -r scripts/golden/requirements.txt
python scripts/golden/gen_logicle_golden.py
```

Note the **parameter-order difference**: flowutils is `logicle(data, ch, t, m, w, a)`;
joeee `LogicleTransform` is `(T, W, M, A)`. The generator maps between them.

### Parameter cases covered

| T | W | M | A | scenario |
|---|---|---|---|----------|
| 262144 | 0.5 | 4.5 | 0 | classic 18-bit fluorescence |
| 262144 | 1.0 | 4.5 | 0 | wider linearization region |
| 262144 | 0.5 | 4.5 | 0.5 | additional negative decades |
| 1048576 | 0.5 | 5.0 | 0 | 20-bit |
| 16384 | 0.5 | 4.0 | 0 | 14-bit |

The forward grid includes negatives, zero, small values, and an intentionally
over-range value (`1.5·T`, scale > 1) to exercise the root-finder's bracket
extension.

## 3. TS ↔ Rust parity

`packages/cytometry-wasm/src/lib.rs` tests assert the C-ABI kernel
(`logicle_scale_into`) matches the in-crate `Logicle` struct, and both match the
flowutils CSV — so the WASM path used at scale is held to the same oracle.

## Now closed (also flowutils-validated)

- **Hyperlog** — matches flowutils to ~3e-17 across 5 parameter cases incl. the
  reflected negative region (`hyperlog.golden.json`). This pinned down that
  hyperlog reflects about `x1` like logicle.
- **Compensation** — matches `flowutils.compensate` (`solve(Sᵀ, observed)`) to
  `<1e-6` on an asymmetric 3×3 spillover (`compensation.golden.json`). This
  caught and fixed a transpose bug: applying `inv(S)` instead of `inv(Sᵀ)`.
- **Gating geometry** — `PolygonGate` and `EllipseGate` match
  `points_in_polygon` (winding) and `points_in_ellipsoid` (covariance form) with
  **zero mismatches over ~18k random points** across simple/concave/irregular
  polygons and rotated ellipses (`gating.golden.json`).

## Heavy / property tests

`test/property.*.test.ts` fuzz the invariants (≈45k assertions total):
transforms round-trip + monotonic over random valid params; bitset boolean
algebra vs a `Set` reference incl. De Morgan at 1M bits; `PolygonGate` vs an
independent convex reference; `channelStats` vs naive; histogram conservation at
500k events; and a 4-level gate hierarchy at 100k events through the controller.

## What's still open

- Validation against **whole real FCS files** (FlowJo `.wsp` gated counts) — the
  per-op oracles above are stronger unit-level checks; an end-to-end fixture is
  the next rung.
- **asinh** golden values (flowutils provides `asinh`) — trivial to add; asinh is
  already self-consistent-tested and closed-form.
