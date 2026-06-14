import type { Population } from "../population.ts";

/**
 * Single-cell debarcoding for multiplexed mass cytometry — clean-room of the
 * Zunder/Finck deconvolution used by CATALYST (assignPrelim/estCutoffs). Each
 * sample has a binary barcode over `nChannels` with a constant number of
 * positive channels `npos`. For an event, the `npos` highest barcode channels
 * are its "on" set; it is assigned to the matching scheme row, and the
 * separation = (lowest-on − highest-off) gates ambiguous events to -1.
 */
export interface DebarcodeResult {
  /** event -> sample index (row of key), or -1 if unassigned. */
  labels: Int32Array;
  /** event -> barcode separation (gap between lowest-on and highest-off). */
  separation: Float64Array;
}

export function debarcode(
  barcodeColumns: ArrayLike<number>[],
  key: number[][],
  opts: { cutoff?: number; parent?: Population } = {},
): DebarcodeResult {
  const nCh = barcodeColumns.length;
  const cutoff = opts.cutoff ?? 0;
  const npos = key[0].reduce((s, v) => s + v, 0);
  for (const row of key) {
    if (row.length !== nCh) throw new Error("debarcode: key width != channels");
    if (row.reduce((s, v) => s + v, 0) !== npos)
      throw new Error("debarcode: non-constant barcode weight");
  }
  // Map "on-set" (sorted indices joined) -> sample index.
  const lookup = new Map<string, number>();
  key.forEach((row, s) => {
    const on = row.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    lookup.set(on.join(","), s);
  });

  const total = barcodeColumns[0].length;
  const labels = new Int32Array(total).fill(-1);
  const separation = new Float64Array(total);

  const classify = (e: number) => {
    const vals = barcodeColumns.map((c, ch) => ({ ch, v: c[e] }));
    vals.sort((a, b) => b.v - a.v);
    const onSet = vals
      .slice(0, npos)
      .map((x) => x.ch)
      .sort((a, b) => a - b);
    const sep = vals[npos - 1].v - vals[npos].v;
    separation[e] = sep;
    const s = lookup.get(onSet.join(","));
    if (s !== undefined && sep >= cutoff) labels[e] = s;
  };

  if (opts.parent) opts.parent.forEach(classify);
  else for (let e = 0; e < total; e++) classify(e);

  return { labels, separation };
}
