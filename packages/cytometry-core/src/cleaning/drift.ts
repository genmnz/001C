import { EventMatrix } from "../matrix.ts";

/**
 * Instrument-drift detection over acquisition order (≈ time): bin the events,
 * track each channel's per-bin median, and report drift as the normalized slope
 * of a least-squares line through the bin medians (PeacoQC-style monotonic-drift
 * warning; clean-room). |drift| ≈ fraction of the channel range traversed across
 * the run; `flagged` marks channels exceeding `threshold`.
 */
export interface DriftReport {
  channels: string[];
  /** Normalized drift per channel (slope·nBins / range). */
  drift: number[];
  flagged: boolean[];
}

function median(a: number[]): number {
  if (a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function detectDrift(
  matrix: EventMatrix,
  opts: { bins?: number; threshold?: number; channels?: string[] } = {},
): DriftReport {
  const n = matrix.eventCount;
  const nBins = Math.min(opts.bins ?? 50, n);
  const threshold = opts.threshold ?? 0.2;
  const names = opts.channels ?? matrix.channels.map((c) => c.name);
  const cols = names.map((c) => matrix.columnByName(c));
  const binSize = Math.ceil(n / nBins);
  const realBins = Math.ceil(n / binSize);

  const drift: number[] = [];
  const flagged: boolean[] = [];
  for (const col of cols) {
    const meds: number[] = [];
    for (let b = 0; b < realBins; b++) {
      const vals: number[] = [];
      for (let e = b * binSize; e < Math.min(n, (b + 1) * binSize); e++) vals.push(col[e]);
      meds.push(median(vals));
    }
    // Least-squares slope of median vs bin index.
    const m = meds.length;
    let sx = 0;
    let sy = 0;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < m; i++) {
      sx += i;
      sy += meds[i];
      sxy += i * meds[i];
      sxx += i * i;
    }
    const denom = m * sxx - sx * sx || 1;
    const slope = (m * sxy - sx * sy) / denom;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of meds) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const range = hi - lo || 1;
    const d = (slope * (m - 1)) / range; // total median change across the run / range
    drift.push(d);
    flagged.push(Math.abs(d) > threshold);
  }
  return { channels: names, drift, flagged };
}
