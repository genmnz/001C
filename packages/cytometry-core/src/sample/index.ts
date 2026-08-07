import { knn } from "../graph/knn.ts";
import { EventMatrix, type ChannelMeta } from "../matrix.ts";
import { Population } from "../population.ts";
import { percentile } from "../stats/descriptive.ts";

/**
 * Sample-level operations: concatenate, downsample, and export. Metadata
 * bookkeeping + column copies (TS); the per-event work is linear and not a
 * transform hot loop. Reimplemented from Spectre's do.merge / do.subsample
 * patterns (MIT). Invariant everywhere: event-count conservation.
 */

/** Concatenate samples that share the same channels (by name + order). */
export function concatenate(matrices: EventMatrix[]): EventMatrix {
  if (matrices.length === 0) throw new Error("concatenate: no samples");
  const first = matrices[0];
  const names = first.channels.map((c) => c.name);
  for (const m of matrices) {
    if (m.channelCount !== first.channelCount)
      throw new Error("concatenate: channel count mismatch");
    for (let c = 0; c < names.length; c++) {
      if (m.channels[c].name !== names[c])
        throw new Error(`concatenate: channel mismatch at ${c}`);
    }
  }
  const total = matrices.reduce((s, m) => s + m.eventCount, 0);
  const channels: ChannelMeta[] = first.channels.map((c) => ({ ...c }));
  const out = EventMatrix.allocate(total, channels);
  for (let c = 0; c < channels.length; c++) {
    const dst = out.column(c);
    let offset = 0;
    for (const m of matrices) {
      dst.set(m.column(c), offset);
      offset += m.eventCount;
    }
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random downsample to `n` distinct events (reservoir sampling, seeded), within
 * an optional parent population. Returns the kept events as a Population.
 */
export function downsample(
  total: number,
  n: number,
  opts: { seed?: number; parent?: Population } = {},
): Population {
  const rng = mulberry32(opts.seed ?? 1);
  const indices: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => indices.push(i));
  else for (let i = 0; i < total; i++) indices.push(i);

  const pop = new Population(total, undefined, `downsample(${n})`);
  if (n >= indices.length) {
    for (const i of indices) pop.set(i);
    return pop;
  }
  // Reservoir over the index list.
  const reservoir = indices.slice(0, n);
  for (let k = n; k < indices.length; k++) {
    const j = Math.floor(rng() * (k + 1));
    if (j < n) reservoir[j] = indices[k];
  }
  for (const i of reservoir) pop.set(i);
  return pop;
}

/**
 * Density-dependent downsampling (SPADE, Qiu et al. 2011 — clean-room from the
 * published description). Thins dense regions while keeping rare/low-density
 * cells, so downstream clustering / DR see rare populations at boosted weight
 * instead of drowning in the dominant blobs. Also a speed lever: fewer events
 * into t-SNE/UMAP/FlowSOM without discarding the biology.
 *
 * Local density is estimated from the k-th nearest-neighbour distance
 * (LD ∝ 1 / dist_k) over the chosen columns. Each event is then:
 *   - dropped if LD < outlier density (noise below the `outlierPercentile`),
 *   - kept with probability TD/LD if LD > target density (`targetPercentile`),
 *   - kept otherwise.
 *
 * Cost is the underlying kNN (brute-force O(N²·d) here, as elsewhere in the
 * engine); run it on a parent population or a coarse random pre-sample for very
 * large N. Deterministic for a given `seed`.
 */
export function densityDependentDownsample(
  columns: ArrayLike<number>[],
  opts: {
    k?: number;
    targetPercentile?: number;
    outlierPercentile?: number;
    seed?: number;
    parent?: Population;
  } = {},
): Population {
  const total = columns[0].length;
  const k = opts.k ?? 15;
  const targetP = opts.targetPercentile ?? 3;
  const outlierP = opts.outlierPercentile ?? 1;
  const rng = mulberry32(opts.seed ?? 1);

  const graph = knn(columns, k, { parent: opts.parent });
  const n = graph.n;
  const eventIndex = graph.eventIndex;

  // Local density from the k-th neighbour distance (larger distance → sparser).
  const eps = 1e-12;
  const density = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const distK = graph.distances[i * k + (k - 1)];
    density[i] = 1 / (distK + eps);
  }

  const sortedDensity = Float64Array.from(density).sort();
  const targetDensity = percentile(sortedDensity, targetP);
  const outlierDensity = percentile(sortedDensity, outlierP);

  const pop = new Population(total, undefined, "density-downsample");
  for (let i = 0; i < n; i++) {
    const ld = density[i];
    if (ld < outlierDensity) continue; // noise / outlier
    if (ld > targetDensity) {
      if (rng() > targetDensity / ld) continue; // thin dense region
    }
    pop.set(eventIndex[i]);
  }
  return pop;
}

/** Systematic (every-k) downsample — deterministic, density-preserving order. */
export function systematicDownsample(total: number, n: number): Population {
  const pop = new Population(total, undefined, `systematic(${n})`);
  if (n >= total) {
    for (let i = 0; i < total; i++) pop.set(i);
    return pop;
  }
  const step = total / n;
  for (let k = 0; k < n; k++) pop.set(Math.floor(k * step));
  return pop;
}

/**
 * Export a population's events to CSV (header = channel names). Optional column
 * transform map (channel -> fn) for exporting transformed values.
 */
export function exportCsv(
  matrix: EventMatrix,
  population?: Population,
  transform?: (channel: string, value: number) => number,
): string {
  const names = matrix.channels.map((c) => c.name);
  const cols = matrix.channels.map((c) => matrix.columnByName(c.name));
  const rows: string[] = [names.join(",")];
  const emit = (e: number) => {
    const cells = new Array(names.length);
    for (let c = 0; c < names.length; c++) {
      const v = transform ? transform(names[c], cols[c][e]) : cols[c][e];
      cells[c] = String(v);
    }
    rows.push(cells.join(","));
  };
  if (population) population.forEach(emit);
  else for (let e = 0; e < matrix.eventCount; e++) emit(e);
  return rows.join("\n");
}
