/**
 * CytoNorm (Van Gassen et al. 2020, doi:10.1002/cyto.a.23904; CC BY) —
 * shared-control batch normalization. Clean-room: cluster the controls (FlowSOM,
 * elsewhere in the engine), and per cluster × marker × batch learn the quantile
 * function, then map each batch's quantiles to a common goal (the mean across
 * batches) via monotone piecewise-linear interpolation. Applied per event by its
 * cluster + batch. (The per-event apply is the hot loop; quantile fitting is
 * cheap.) Here the "spline" is piecewise-linear over nq quantile knots.
 */
export interface CytoNormSample {
  batchId: string;
  /** Per-event cluster label (e.g. FlowSOM metacluster). */
  clusterOf: ArrayLike<number>;
  /** Column-major channels. */
  columns: ArrayLike<number>[];
  eventCount: number;
}

interface MarkerModel {
  batches: Map<string, number[]>; // batchId -> nq quantiles
  goal: number[]; // nq quantiles
}
export interface CytoNormModel {
  nq: number;
  markers: number[];
  /** cluster -> marker -> model */
  clusters: Map<number, Map<number, MarkerModel>>;
}

function quantiles(values: number[], nq: number): number[] {
  const s = Float64Array.from(values).sort();
  const n = s.length;
  const out = new Array<number>(nq);
  for (let k = 0; k < nq; k++) {
    const p = nq === 1 ? 0 : k / (nq - 1);
    const rank = p * (n - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    out[k] = lo === hi ? s[lo] : s[lo] * (hi - rank) + s[hi] * (rank - lo);
  }
  return out;
}

/** Monotone piecewise-linear map of v from `fromQ` knots to `toQ` knots. */
function mapValue(v: number, fromQ: number[], toQ: number[]): number {
  const n = fromQ.length;
  if (v <= fromQ[0]) return toQ[0];
  if (v >= fromQ[n - 1]) return toQ[n - 1];
  let i = 0;
  while (i < n - 1 && fromQ[i + 1] < v) i++;
  const span = fromQ[i + 1] - fromQ[i];
  const frac = span > 0 ? (v - fromQ[i]) / span : 0;
  return toQ[i] + frac * (toQ[i + 1] - toQ[i]);
}

export function cytoNormTrain(
  samples: CytoNormSample[],
  markers: number[],
  nClusters: number,
  nq = 101,
): CytoNormModel {
  const clusters = new Map<number, Map<number, MarkerModel>>();
  for (let c = 0; c < nClusters; c++) {
    const byMarker = new Map<number, MarkerModel>();
    for (const m of markers) {
      // Gather values per batch (aggregating samples in the same batch).
      const perBatch = new Map<string, number[]>();
      for (const s of samples) {
        const arr = perBatch.get(s.batchId) ?? [];
        const col = s.columns[m];
        for (let e = 0; e < s.eventCount; e++) {
          if (s.clusterOf[e] === c) arr.push(col[e]);
        }
        perBatch.set(s.batchId, arr);
      }
      const batches = new Map<string, number[]>();
      for (const [bid, vals] of perBatch) {
        if (vals.length > 0) batches.set(bid, quantiles(vals, nq));
      }
      // Goal = elementwise mean of batch quantiles.
      const goal = new Array<number>(nq).fill(0);
      let nb = 0;
      for (const q of batches.values()) {
        for (let k = 0; k < nq; k++) goal[k] += q[k];
        nb++;
      }
      if (nb > 0) for (let k = 0; k < nq; k++) goal[k] /= nb;
      byMarker.set(m, { batches, goal });
    }
    clusters.set(c, byMarker);
  }
  return { nq, markers, clusters };
}

/** Apply the model to a sample, returning new column-major data (copy). */
export function cytoNormApply(
  model: CytoNormModel,
  sample: CytoNormSample,
): Float64Array[] {
  const out = sample.columns.map((col) => {
    const a = new Float64Array(sample.eventCount);
    for (let e = 0; e < sample.eventCount; e++) a[e] = col[e];
    return a;
  });
  for (const m of model.markers) {
    const col = out[m];
    for (let e = 0; e < sample.eventCount; e++) {
      const c = sample.clusterOf[e];
      const mm = model.clusters.get(c)?.get(m);
      if (!mm) continue;
      const fromQ = mm.batches.get(sample.batchId);
      if (!fromQ) continue;
      col[e] = mapValue(col[e], fromQ, mm.goal);
    }
  }
  return out;
}
