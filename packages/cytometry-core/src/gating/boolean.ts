import { Population } from "../population.ts";

/**
 * Boolean gates are just bitwise algebra over population words — no per-event
 * geometry. AND/OR/NOT/XOR are O(events / 32).
 */
export function and(...pops: Population[]): Population {
  return reduce(pops, (a, b) => a.and(b));
}
export function or(...pops: Population[]): Population {
  return reduce(pops, (a, b) => a.or(b));
}
export function xor(a: Population, b: Population): Population {
  return a.xor(b);
}
export function not(p: Population): Population {
  return p.not();
}
/** Set difference: events in `a` but not in `b`. */
export function difference(a: Population, b: Population): Population {
  return a.andNot(b);
}

function reduce(
  pops: Population[],
  op: (a: Population, b: Population) => Population,
): Population {
  if (pops.length === 0) throw new Error("boolean gate: no operands");
  let acc = pops[0];
  for (let i = 1; i < pops.length; i++) acc = op(acc, pops[i]);
  return acc;
}
