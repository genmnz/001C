import { EventMatrix } from "../matrix.ts";
import { Population } from "../population.ts";

/**
 * flowCut-style QC (Meskas et al.; flowCut is Artistic-2.0, portable): split the
 * acquisition (event order ≈ time) into bins, take each channel's per-bin median,
 * and flag bins whose median deviates from the across-bin median by more than
 * `madThreshold` × MAD on any channel. Returns the kept events (non-flagged
 * bins) — removes clogs / unstable acquisition periods.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function flowCutQC(
  matrix: EventMatrix,
  opts: { bins?: number; madThreshold?: number; channels?: string[] } = {},
): Population {
  const n = matrix.eventCount;
  const nBins = Math.min(opts.bins ?? 100, n);
  const madThreshold = opts.madThreshold ?? 4;
  const cols = (opts.channels ?? matrix.channels.map((c) => c.name)).map((c) =>
    matrix.columnByName(c),
  );

  const binSize = Math.ceil(n / nBins);
  const binStart = (b: number) => b * binSize;
  const binEnd = (b: number) => Math.min(n, (b + 1) * binSize);
  const realBins = Math.ceil(n / binSize);

  // Per-bin per-channel medians.
  const binMed: number[][] = []; // [bin][channel]
  for (let b = 0; b < realBins; b++) {
    const meds: number[] = [];
    for (const col of cols) {
      const vals: number[] = [];
      for (let e = binStart(b); e < binEnd(b); e++) vals.push(col[e]);
      meds.push(median(vals));
    }
    binMed.push(meds);
  }

  // Flag bins that are outliers in any channel (median ± madThreshold·MAD).
  const flagged = new Uint8Array(realBins);
  for (let c = 0; c < cols.length; c++) {
    const series = binMed.map((m) => m[c]);
    const gMed = median(series);
    const mad = median(series.map((v) => Math.abs(v - gMed))) || 1e-9;
    for (let b = 0; b < realBins; b++) {
      if (Math.abs(series[b] - gMed) > madThreshold * mad) flagged[b] = 1;
    }
  }

  const keep = new Population(n, undefined, "flowCut-kept");
  for (let b = 0; b < realBins; b++) {
    if (flagged[b]) continue;
    for (let e = binStart(b); e < binEnd(b); e++) keep.set(e);
  }
  return keep;
}
