#!/usr/bin/env python3
"""Generate ALL golden values from the flowutils external oracle (FlowKit's C
extensions / Moore-Parks Stanford reference): logicle + hyperlog transforms,
compensation, and polygon/ellipse gating. See docs/VALIDATION.md.

    python3 -m venv .venv-golden && . .venv-golden/bin/activate
    pip install -r scripts/golden/requirements.txt
    python scripts/golden/gen_golden.py

Writes golden JSON into packages/cytometry-core/test/golden/ and the logicle CSV
into packages/cytometry-wasm/tests/ (for the Rust test).
"""
import json
import os

import numpy as np
import flowutils
from flowutils import compensate as C
from flowutils import gating as G
from flowutils import transforms as T

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
GOLD = os.path.join(ROOT, "packages/cytometry-core/test/golden")
CSV_OUT = os.path.join(ROOT, "packages/cytometry-wasm/tests/logicle_golden.csv")

PROV = {
    "oracle": "flowutils",
    "version": getattr(flowutils, "__version__", "unknown"),
    "numpy": np.__version__,
    "generated_by": "scripts/golden/gen_golden.py",
    "note": "flowutils = FlowKit C extensions (Moore-Parks / GatingML 2.0). "
    "Transform param order is (t, m, w, a); joeee is (T, W, M, A).",
}

PARAM_CASES = [
    (262144.0, 0.5, 4.5, 0.0),
    (262144.0, 1.0, 4.5, 0.0),
    (262144.0, 0.5, 4.5, 0.5),
    (1048576.0, 0.5, 5.0, 0.0),
    (16384.0, 0.5, 4.0, 0.0),
]


def forward_values(t):
    return [
        -0.01 * t, -1000.0, -100.0, -10.0, -1.0, 0.0,
        1.0, 10.0, 100.0, 1000.0,
        0.01 * t, 0.1 * t, 0.5 * t, t, 1.5 * t,
    ]


INVERSE_SCALES = [round(0.1 * i, 4) for i in range(0, 11)]


def transform_cases(fwd_fn, inv_fn, write_csv=False):
    cases = []
    csv_rows = ["T,W,M,A,x,scale"]
    for (t, w, m, a) in PARAM_CASES:
        xs = np.array(forward_values(t), dtype=float).reshape(-1, 1)
        fwd = fwd_fn(xs.copy(), channel_indices=[0], t=t, m=m, w=w, a=a).ravel()
        ss = np.array(INVERSE_SCALES, dtype=float).reshape(-1, 1)
        inv = inv_fn(ss.copy(), channel_indices=[0], t=t, m=m, w=w, a=a).ravel()
        cases.append({
            "params": {"T": t, "W": w, "M": m, "A": a},
            "forward": [{"x": float(x), "scale": float(s)} for x, s in zip(xs.ravel(), fwd)],
            "inverse": [{"s": float(s), "value": float(v)} for s, v in zip(ss.ravel(), inv)],
        })
        if write_csv:
            for x, s in zip(xs.ravel(), fwd):
                csv_rows.append(f"{t},{w},{m},{a},{float(x)!r},{float(s)!r}")
    return cases, csv_rows


def gen_compensation():
    rng = np.random.default_rng(7)
    # Asymmetric 3x3 spillover (catches transpose bugs).
    spill = np.array([
        [1.00, 0.05, 0.02],
        [0.18, 1.00, 0.06],
        [0.03, 0.12, 1.00],
    ])
    observed = rng.uniform(0, 50000, size=(24, 3))
    fluoro = [0, 1, 2]
    compd = C.compensate(observed.copy(), spill, fluoro_indices=fluoro)
    return {
        "provenance": PROV,
        "cases": [{
            "channels": ["c0", "c1", "c2"],
            "spill": spill.ravel().tolist(),
            "observed": observed.tolist(),
            "compensated": compd.tolist(),
        }],
    }


def gen_gating():
    rng = np.random.default_rng(11)
    polygons = []
    for verts in [
        [[0, 0], [10, 0], [10, 10], [0, 10]],            # square
        [[0, 0], [10, 0], [10, 10], [5, 4], [0, 10]],    # concave notch
        [[-3, -3], [4, -1], [6, 5], [0, 8], [-5, 3]],    # irregular convex-ish
    ]:
        v = np.array(verts, dtype=float)
        lo = v.min(0) - 2
        hi = v.max(0) + 2
        pts = rng.uniform(lo, hi, size=(3000, 2))
        inside = G.points_in_polygon(v, pts).astype(int)
        polygons.append({
            "vertices": v.tolist(),
            "points": pts.tolist(),
            "inside": inside.tolist(),
        })

    ellipses = []
    for (cx, cy, rx, ry, ang) in [
        (2.0, -1.0, 5.0, 2.0, 0.6),
        (0.0, 0.0, 3.0, 3.0, 0.0),
        (50.0, 100.0, 30.0, 10.0, -0.9),
    ]:
        c, s = np.cos(ang), np.sin(ang)
        R = np.array([[c, -s], [s, c]])
        cov = R @ np.diag([rx * rx, ry * ry]) @ R.T
        lo = [cx - rx - ry - 2, cy - rx - ry - 2]
        hi = [cx + rx + ry + 2, cy + rx + ry + 2]
        pts = rng.uniform(lo, hi, size=(3000, 2))
        inside = G.points_in_ellipsoid(cov, np.array([cx, cy]), 1.0, pts).astype(int)
        ellipses.append({
            "cx": cx, "cy": cy, "rx": rx, "ry": ry, "angle": ang,
            "points": pts.tolist(),
            "inside": inside.tolist(),
        })

    return {"provenance": PROV, "polygons": polygons, "ellipses": ellipses}


def main():
    os.makedirs(GOLD, exist_ok=True)

    logicle_cases, csv_rows = transform_cases(T.logicle, T.logicle_inverse, write_csv=True)
    with open(os.path.join(GOLD, "logicle.golden.json"), "w") as f:
        json.dump({"provenance": PROV, "cases": logicle_cases}, f, indent=2)
    with open(CSV_OUT, "w") as f:
        f.write("\n".join(csv_rows) + "\n")

    hyperlog_cases, _ = transform_cases(T.hyperlog, T.hyperlog_inverse)
    with open(os.path.join(GOLD, "hyperlog.golden.json"), "w") as f:
        json.dump({"provenance": PROV, "cases": hyperlog_cases}, f, indent=2)

    with open(os.path.join(GOLD, "compensation.golden.json"), "w") as f:
        json.dump(gen_compensation(), f, indent=2)

    with open(os.path.join(GOLD, "gating.golden.json"), "w") as f:
        json.dump(gen_gating(), f, indent=2)

    print("wrote logicle / hyperlog / compensation / gating golden files + logicle CSV")


if __name__ == "__main__":
    main()
