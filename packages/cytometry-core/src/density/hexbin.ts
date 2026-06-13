import type { Population } from "../population.ts";

/**
 * Hexagonal binning via axial cube-coordinate rounding (Red Blob Games method) —
 * well-defined: every point maps to exactly one hexagon, so counts are conserved.
 * Returns occupied hexagons with pixel centers + counts (for hexbin plots).
 */
export interface HexBin {
  /** Pixel-space center. */
  x: number;
  y: number;
  count: number;
}

const SQRT3 = Math.sqrt(3);

function hexRound(q: number, r: number): [number, number] {
  // cube coords
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx, rz];
}

export function hexbin(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  size: number,
  parent?: Population,
): HexBin[] {
  const bins = new Map<string, { q: number; r: number; count: number }>();
  const add = (i: number) => {
    const x = xs[i];
    const y = ys[i];
    // pixel -> axial (pointy-top)
    const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
    const r = ((2 / 3) * y) / size;
    const [cq, cr] = hexRound(q, r);
    const key = `${cq},${cr}`;
    const b = bins.get(key);
    if (b) b.count++;
    else bins.set(key, { q: cq, r: cr, count: 1 });
  };
  if (parent) parent.forEach(add);
  else for (let i = 0; i < xs.length; i++) add(i);

  return [...bins.values()].map((b) => ({
    x: size * SQRT3 * (b.q + b.r / 2),
    y: size * 1.5 * b.r,
    count: b.count,
  }));
}
