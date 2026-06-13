#!/usr/bin/env python3
"""Generate logicle golden values from an INDEPENDENT external oracle (flowutils,
the FlowKit / Stanford Moore-Parks C implementation) so the joeee TypeScript and
Rust logicle ports can be validated against a reference they did not derive from.

This is the strongest correctness gate available: round-trip + analytic anchors
prove self-consistency, but only an external oracle catches a systematic error in
the biexponential parameter construction. (As of this writing the joeee TS port
matches flowutils to ~5e-17 across the grid below.)

Usage:
    python3 -m venv .venv-golden && . .venv-golden/bin/activate
    pip install -r scripts/golden/requirements.txt
    python scripts/golden/gen_logicle_golden.py

Writes:
    packages/cytometry-core/test/golden/logicle.golden.json   (TS test)
    packages/cytometry-wasm/tests/logicle_golden.csv          (Rust test)
"""
import json
import os
import numpy as np
import flowutils
from flowutils import transforms as T

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
JSON_OUT = os.path.join(ROOT, "packages/cytometry-core/test/golden/logicle.golden.json")
CSV_OUT = os.path.join(ROOT, "packages/cytometry-wasm/tests/logicle_golden.csv")

# (T, W, M, A) parameter cases spanning real-world configurations.
PARAM_CASES = [
    (262144.0, 0.5, 4.5, 0.0),    # classic 18-bit fluorescence
    (262144.0, 1.0, 4.5, 0.0),    # wider linearization region
    (262144.0, 0.5, 4.5, 0.5),    # additional negative decades (A > 0)
    (1048576.0, 0.5, 5.0, 0.0),   # 20-bit
    (16384.0, 0.5, 4.0, 0.0),     # 14-bit
]


def forward_values(t):
    return [
        -0.01 * t, -1000.0, -100.0, -10.0, -1.0, 0.0,
        1.0, 10.0, 100.0, 1000.0,
        0.01 * t, 0.1 * t, 0.5 * t, t, 1.5 * t,  # last is intentionally over-range
    ]


# Scale-space grid for the inverse transform (display -> data value).
INVERSE_SCALES = [round(0.1 * i, 4) for i in range(0, 11)]


def main():
    cases = []
    csv_rows = ["T,W,M,A,x,scale"]

    for (t, w, m, a) in PARAM_CASES:
        xs = np.array(forward_values(t), dtype=float).reshape(-1, 1)
        fwd = T.logicle(xs.copy(), channel_indices=[0], t=t, m=m, w=w, a=a).ravel()

        ss = np.array(INVERSE_SCALES, dtype=float).reshape(-1, 1)
        inv = T.logicle_inverse(ss.copy(), channel_indices=[0], t=t, m=m, w=w, a=a).ravel()

        forward = [{"x": float(x), "scale": float(s)} for x, s in zip(xs.ravel(), fwd)]
        inverse = [{"s": float(s), "value": float(v)} for s, v in zip(ss.ravel(), inv)]

        cases.append({
            "params": {"T": t, "W": w, "M": m, "A": a},
            "forward": forward,
            "inverse": inverse,
        })
        for x, s in zip(xs.ravel(), fwd):
            csv_rows.append(f"{t},{w},{m},{a},{float(x)!r},{float(s)!r}")

    doc = {
        "provenance": {
            "oracle": "flowutils",
            "version": getattr(flowutils, "__version__", "unknown"),
            "numpy": np.__version__,
            "generated_by": "scripts/golden/gen_logicle_golden.py",
            "note": (
                "flowutils is the FlowKit logicle C extension, derived from the "
                "Moore & Parks 2012 Stanford reference. flowutils param order is "
                "(t, m, w, a); joeee LogicleTransform order is (T, W, M, A)."
            ),
        },
        "cases": cases,
    }

    os.makedirs(os.path.dirname(JSON_OUT), exist_ok=True)
    with open(JSON_OUT, "w") as f:
        json.dump(doc, f, indent=2)
    os.makedirs(os.path.dirname(CSV_OUT), exist_ok=True)
    with open(CSV_OUT, "w") as f:
        f.write("\n".join(csv_rows) + "\n")

    print(f"wrote {JSON_OUT} ({len(cases)} param cases)")
    print(f"wrote {CSV_OUT} ({len(csv_rows) - 1} forward rows)")


if __name__ == "__main__":
    main()
