import type { SpilloverMatrix } from "./types.ts";

/**
 * Parse a compensation/spillover matrix from TEXT. FCS 3.1 uses `$SPILLOVER`;
 * older files and FlowJo use `$COMP` or the vendor `SPILL` key. Format:
 *   n, ch1, ch2, ..., chn, v11, v12, ..., vnn   (row-major)
 */
export function parseSpillover(
  text: Map<string, string>,
): SpilloverMatrix | null {
  const raw =
    text.get("$SPILLOVER") ?? text.get("$COMP") ?? text.get("SPILL") ?? null;
  if (!raw) return null;

  const parts = raw.split(",").map((s) => s.trim());
  const n = parseInt(parts[0], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (parts.length < 1 + n + n * n) return null;

  const channels = parts.slice(1, 1 + n);
  const nums = parts.slice(1 + n, 1 + n + n * n).map(Number);
  if (nums.some((v) => !Number.isFinite(v))) return null;

  return { channels, values: Float64Array.from(nums) };
}
