import type { SpilloverMatrix } from "./apply.ts";
import { invertSquare } from "./invert.ts";

export interface SpilloverIssue {
  severity: "error" | "warning";
  message: string;
}

export interface SpilloverValidation {
  /** True iff there are no "error"-severity issues — safe to apply. */
  valid: boolean;
  issues: SpilloverIssue[];
}

/**
 * Validate a spillover / compensation matrix before it is inverted and applied.
 * `applyCompensation` computes `inv(Sᵀ)·obs` over millions of events, so a bad
 * matrix is far better caught up front with a clear message than discovered as
 * NaNs downstream. `error` issues block application (`valid: false`); `warning`
 * issues are suspicious but not fatal (e.g. an unnormalized diagonal). Pure and
 * allocation-light: intended for a UI's "validate before compensate" step.
 */
export function validateSpillover(spill: SpilloverMatrix): SpilloverValidation {
  const issues: SpilloverIssue[] = [];
  const error = (message: string) => issues.push({ severity: "error", message });
  const warn = (message: string) => issues.push({ severity: "warning", message });
  const fatal = (): SpilloverValidation => ({ valid: false, issues });

  const n = spill.channels.length;
  if (n === 0) {
    error("spillover has no channels");
    return fatal();
  }
  if (spill.values.length !== n * n) {
    error(`values length ${spill.values.length} ≠ channels² (${n}² = ${n * n})`);
    return fatal(); // geometry is undefined; no point inspecting entries
  }

  // Duplicate channel names make column resolution ambiguous on apply.
  const seen = new Set<string>();
  for (const name of spill.channels) {
    if (seen.has(name)) error(`duplicate channel "${name}"`);
    seen.add(name);
  }

  // Non-finite entries (NaN/Inf) would propagate through the inverse.
  let finite = true;
  for (let i = 0; i < spill.values.length; i++) {
    if (!Number.isFinite(spill.values[i])) {
      error(`non-finite value at index ${i}`);
      finite = false;
      break;
    }
  }

  // Diagonal should be ~1 (self-signal, normalized); 0 on the diagonal is fatal.
  if (finite) {
    for (let i = 0; i < n; i++) {
      const d = spill.values[i * n + i];
      if (d === 0) error(`zero on the diagonal for channel "${spill.channels[i]}"`);
      else if (Math.abs(d - 1) > 1e-6)
        warn(`diagonal for "${spill.channels[i]}" is ${d}, expected ~1 (unnormalized?)`);
    }
    // Negative off-diagonal spill is physically unusual — flag, don't block.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = spill.values[i * n + j];
        if (i !== j && v < 0) warn(`negative off-diagonal spill at [${i},${j}] = ${v}`);
      }
    }
  }

  // Singularity: a non-invertible matrix can't compensate. Only worth checking
  // once entries are finite and the shape is square (guaranteed above).
  if (finite && !issues.some((x) => x.severity === "error")) {
    try {
      invertSquare(spill.values, n);
    } catch {
      error("matrix is singular (non-invertible) — cannot compensate");
    }
  }

  return { valid: !issues.some((x) => x.severity === "error"), issues };
}
