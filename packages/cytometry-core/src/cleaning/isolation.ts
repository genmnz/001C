import { EventMatrix } from "../matrix.ts";
import { Population } from "../population.ts";

/**
 * Isolation Forest anomaly detection (Liu et al. 2008) — the anomaly-scoring
 * primitive behind PeacoQC-style cleaning (PeacoQC is GPL; this is clean-room
 * from the iForest paper). Random axis-aligned splits isolate outliers in fewer
 * steps, so a short expected path length ⇒ high anomaly score. Returns per-event
 * scores in [0,1] and the inlier Population (score below the contamination cut).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface INode {
  feature?: number;
  split?: number;
  left?: INode;
  right?: INode;
  size: number; // points reaching this external node
  depth: number;
}

function cFactor(n: number): number {
  if (n <= 1) return 0;
  const H = Math.log(n - 1) + 0.5772156649; // harmonic ≈ ln + Euler
  return 2 * H - (2 * (n - 1)) / n;
}

function buildTree(
  pts: number[],
  cols: ArrayLike<number>[],
  depth: number,
  maxDepth: number,
  rng: () => number,
): INode {
  if (depth >= maxDepth || pts.length <= 1) {
    return { size: pts.length, depth };
  }
  const d = cols.length;
  const feature = Math.floor(rng() * d);
  let min = Infinity;
  let max = -Infinity;
  for (const p of pts) {
    const v = cols[feature][p];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return { size: pts.length, depth };
  const split = min + rng() * (max - min);
  const left: number[] = [];
  const right: number[] = [];
  for (const p of pts) (cols[feature][p] < split ? left : right).push(p);
  return {
    feature,
    split,
    size: pts.length,
    depth,
    left: buildTree(left, cols, depth + 1, maxDepth, rng),
    right: buildTree(right, cols, depth + 1, maxDepth, rng),
  };
}

function pathLength(node: INode, cols: ArrayLike<number>[], e: number): number {
  let cur = node;
  let len = 0;
  while (cur.feature !== undefined) {
    len++;
    cur = cols[cur.feature][e] < cur.split! ? cur.left! : cur.right!;
  }
  return len + cFactor(cur.size); // adjust for unsplit subtree
}

export interface IsolationForestResult {
  scores: Float64Array;
  inliers: Population;
}

export function isolationForest(
  matrix: EventMatrix,
  opts: {
    trees?: number;
    sampleSize?: number;
    seed?: number;
    contamination?: number;
    channels?: string[];
  } = {},
): IsolationForestResult {
  const n = matrix.eventCount;
  const trees = opts.trees ?? 100;
  const sampleSize = Math.min(opts.sampleSize ?? 256, n);
  const contamination = opts.contamination ?? 0.05;
  const cols = (opts.channels ?? matrix.channels.map((c) => c.name)).map((c) =>
    matrix.columnByName(c),
  );
  const rng = mulberry32(opts.seed ?? 1);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, sampleSize)));
  const c = cFactor(sampleSize);

  const forest: INode[] = [];
  for (let t = 0; t < trees; t++) {
    const sub: number[] = [];
    for (let s = 0; s < sampleSize; s++) sub.push(Math.floor(rng() * n));
    forest.push(buildTree(sub, cols, 0, maxDepth, rng));
  }

  const scores = new Float64Array(n);
  for (let e = 0; e < n; e++) {
    let sum = 0;
    for (const tree of forest) sum += pathLength(tree, cols, e);
    scores[e] = Math.pow(2, -sum / trees / c);
  }

  // Inliers = below the contamination-quantile score threshold.
  const sortedScores = Float64Array.from(scores).sort();
  const cutIdx = Math.min(n - 1, Math.floor((1 - contamination) * n));
  const threshold = sortedScores[cutIdx];
  const inliers = new Population(n, undefined, "iforest-inliers");
  for (let e = 0; e < n; e++) if (scores[e] <= threshold) inliers.set(e);
  return { scores, inliers };
}
