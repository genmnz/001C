import { nnls } from "../compensation/unmix.ts";
import type { Population } from "../population.ts";

/**
 * Mass-cytometry isotope/oxide spillover correction — clean-room of CATALYST
 * compCytof. Given the d×d spillover matrix S (observed = S·true, mostly
 * diagonal with small +1/−1 isotope and oxide impurities), recover true counts
 * per event by NNLS (non-negative — counts can't be negative), which is the
 * CATALYST default and avoids the negative artifacts of plain matrix inversion.
 */
export function isotopeCompensate(
  spillover: number[][],
  columns: ArrayLike<number>[],
  opts: { parent?: Population } = {},
): Float64Array[] {
  const d = columns.length;
  if (spillover.length !== d) throw new Error("isotopeCompensate: size mismatch");
  const n = columns[0].length;
  const out = columns.map(() => new Float64Array(n));
  const x = new Array<number>(d);

  const fix = (e: number) => {
    for (let k = 0; k < d; k++) x[k] = columns[k][e];
    const a = nnls(spillover, x);
    for (let k = 0; k < d; k++) out[k][e] = a[k];
  };
  if (opts.parent) opts.parent.forEach(fix);
  else for (let e = 0; e < n; e++) fix(e);
  return out;
}
