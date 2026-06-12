import { Population } from "../population.ts";

/** The four quadrants produced by a crosshair at (xThreshold, yThreshold). */
export interface QuadrantResult {
  /** x < tx, y >= ty */ upperLeft: Population;
  /** x >= tx, y >= ty */ upperRight: Population;
  /** x < tx, y < ty */ lowerLeft: Population;
  /** x >= tx, y < ty */ lowerRight: Population;
}

/**
 * Quadrant gate: a single pass over the data splits a population into the four
 * regions around a crosshair. One pass instead of four independent gate
 * evaluations.
 */
export function quadrant(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  tx: number,
  ty: number,
  parent?: Population,
): QuadrantResult {
  const n = xs.length;
  const ul = new Population(n, undefined, "Q-UL");
  const ur = new Population(n, undefined, "Q-UR");
  const ll = new Population(n, undefined, "Q-LL");
  const lr = new Population(n, undefined, "Q-LR");

  const classify = (i: number) => {
    const x = xs[i];
    const y = ys[i];
    if (y >= ty) {
      if (x >= tx) ur.set(i);
      else ul.set(i);
    } else {
      if (x >= tx) lr.set(i);
      else ll.set(i);
    }
  };

  if (parent) parent.forEach(classify);
  else for (let i = 0; i < n; i++) classify(i);

  return { upperLeft: ul, upperRight: ur, lowerLeft: ll, lowerRight: lr };
}
