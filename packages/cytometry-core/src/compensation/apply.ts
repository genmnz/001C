import { EventMatrix } from "../matrix.ts";
import { invertSquare } from "./invert.ts";

/**
 * A spillover (compensation) matrix as carried by FCS `$SPILLOVER` / `$COMP`:
 * `S[i][j]` is the fraction of detector j's signal that leaks into detector i's
 * channel. Observed = S * True, so compensation un-mixes via True = S^-1 *
 * Observed, applied per event across the spillover channels.
 */
export interface SpilloverMatrix {
  /** Channel $PnN names, in matrix order. */
  channels: string[];
  /** Row-major n*n spillover values (f64). */
  values: Float64Array;
}

/**
 * Compensate an event matrix in place over the channels named in `spill`.
 * Channels not present in the spillover are left untouched. The inverse is
 * computed once (f64) and applied as a small dense mat-vec per event.
 */
export function applyCompensation(
  matrix: EventMatrix,
  spill: SpilloverMatrix,
): void {
  const n = spill.channels.length;
  if (spill.values.length !== n * n)
    throw new Error("applyCompensation: spillover size mismatch");
  const inv = invertSquare(spill.values, n);

  // Resolve spillover channel order to column views in the event matrix.
  const cols = spill.channels.map((name) => matrix.columnByName(name));

  const events = matrix.eventCount;
  const obs = new Float64Array(n);
  for (let e = 0; e < events; e++) {
    for (let i = 0; i < n; i++) obs[i] = cols[i][e];
    for (let i = 0; i < n; i++) {
      let acc = 0;
      const row = i * n;
      for (let j = 0; j < n; j++) acc += inv[row + j] * obs[j];
      cols[i][e] = acc;
    }
  }
}
