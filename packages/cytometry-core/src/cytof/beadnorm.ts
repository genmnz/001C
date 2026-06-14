/**
 * EQ-bead signal normalization for mass cytometry — clean-room of Finck et al.
 * 2013 (Cytometry A 83A:483) / CATALYST normCytof. Beads have constant true
 * intensity; observed bead signal drifts over acquisition (≈ time = event
 * order). The correction factor at each event is reference / smoothed-bead, and
 * all markers are scaled by it, removing the shared drift.
 */
export function beadNormalize(
  markerColumns: ArrayLike<number>[],
  beadSignal: ArrayLike<number>,
  opts: { window?: number; reference?: number } = {},
): Float64Array[] {
  const n = beadSignal.length;
  const window = opts.window ?? Math.max(5, Math.floor(n / 20));

  // Reference baseline = median of the bead signal.
  const sorted = Float64Array.from(beadSignal).sort();
  const reference =
    opts.reference ??
    (n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2);

  // Centered moving-average estimate of the drift per event.
  const smoothed = new Float64Array(n);
  for (let e = 0; e < n; e++) {
    const lo = Math.max(0, e - window);
    const hi = Math.min(n - 1, e + window);
    let s = 0;
    for (let k = lo; k <= hi; k++) s += beadSignal[k];
    smoothed[e] = s / (hi - lo + 1);
  }

  return markerColumns.map((col) => {
    const out = new Float64Array(n);
    for (let e = 0; e < n; e++) {
      const f = smoothed[e] !== 0 ? reference / smoothed[e] : 1;
      out[e] = col[e] * f;
    }
    return out;
  });
}
