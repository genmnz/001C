import { Population } from "../population.ts";

/**
 * Bridge any clustering result (k-means/DBSCAN/FlowSOM/GMM/PhenoGraph labels)
 * into gateable Populations — i.e. cluster-derived gating. Labels align to the
 * processed point order; pass `eventIndex` (from knn/cluster over a subset) to
 * map back to original event indices. Negative labels (noise) are skipped.
 */
export function labelsToPopulations(
  labels: ArrayLike<number>,
  capacity: number,
  opts: { eventIndex?: ArrayLike<number>; nClusters?: number } = {},
): Population[] {
  let k = opts.nClusters;
  if (k === undefined) {
    k = 0;
    for (let i = 0; i < labels.length; i++) if (labels[i] + 1 > k) k = labels[i] + 1;
  }
  const pops = Array.from(
    { length: k },
    (_, c) => new Population(capacity, undefined, `cluster ${c}`),
  );
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (l < 0 || l >= k) continue;
    pops[l].set(opts.eventIndex ? opts.eventIndex[i] : i);
  }
  return pops;
}
