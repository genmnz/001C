/**
 * Cross-sample population matching: align clusters/populations between two
 * samples by their centroids (marker-mean vectors), greedily pairing the closest
 * unmatched centroids. Returns, for each centroid in A, the matched index in B
 * (or -1 if unmatched when sizes differ). Enables population tracking and
 * consensus across a cohort.
 */
export function matchPopulations(
  centroidsA: number[][],
  centroidsB: number[][],
): number[] {
  const na = centroidsA.length;
  const nb = centroidsB.length;
  const d = centroidsA[0]?.length ?? 0;
  const dist2 = (a: number, b: number) => {
    let s = 0;
    for (let k = 0; k < d; k++) {
      const dv = centroidsA[a][k] - centroidsB[b][k];
      s += dv * dv;
    }
    return s;
  };
  const pairs: { a: number; b: number; d: number }[] = [];
  for (let a = 0; a < na; a++)
    for (let b = 0; b < nb; b++) pairs.push({ a, b, d: dist2(a, b) });
  pairs.sort((x, y) => x.d - y.d);

  const matchA = new Array<number>(na).fill(-1);
  const usedB = new Set<number>();
  for (const { a, b } of pairs) {
    if (matchA[a] !== -1 || usedB.has(b)) continue;
    matchA[a] = b;
    usedB.add(b);
  }
  return matchA;
}
