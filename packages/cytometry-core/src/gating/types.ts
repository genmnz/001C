import { Population } from "../population.ts";

/**
 * Gates operate on already-transformed (display-space) columns. Keeping gate
 * geometry decoupled from the scale transforms is the clean separation: the
 * engine applies a Transform to produce a display column, then the gate is pure
 * geometry over those numbers. This mirrors GatingML, where a gate references
 * dimensions whose transforms are defined elsewhere.
 */
export interface Gate2D {
  readonly kind: string;
  readonly xChannel: string;
  readonly yChannel: string;
  contains(x: number, y: number): boolean;
}

export interface Gate1D {
  readonly kind: string;
  readonly channel: string;
  contains(x: number): boolean;
}

/** Evaluate a 2D gate over column views, writing membership into a Population. */
export function evaluate2D(
  gate: Gate2D,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  parent?: Population,
): Population {
  const n = xs.length;
  const out = new Population(n, undefined, gate.kind);
  if (parent) {
    parent.forEach((i) => {
      if (gate.contains(xs[i], ys[i])) out.set(i);
    });
  } else {
    for (let i = 0; i < n; i++) {
      if (gate.contains(xs[i], ys[i])) out.set(i);
    }
  }
  return out;
}

/** Evaluate a 1D gate over a single column view. */
export function evaluate1D(
  gate: Gate1D,
  xs: ArrayLike<number>,
  parent?: Population,
): Population {
  const n = xs.length;
  const out = new Population(n, undefined, gate.kind);
  if (parent) {
    parent.forEach((i) => {
      if (gate.contains(xs[i])) out.set(i);
    });
  } else {
    for (let i = 0; i < n; i++) {
      if (gate.contains(xs[i])) out.set(i);
    }
  }
  return out;
}
