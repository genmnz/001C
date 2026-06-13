import type { Transform } from "@joeee/cytometry-core";

/**
 * Logicle/biexponential-aware axis ticks. No off-the-shelf scale library
 * (d3-scale's log/symlog included) places ticks correctly on a logicle axis: the
 * spacing is log-like far from zero but linear through the ±W region around zero,
 * and it must show 0 and negative decades. So we own this: ask the engine's
 * Transform where each decade lands in display space, then map to pixels. Pure
 * and testable; works for any Transform (logicle, asinh, log, linear).
 */
export interface Tick {
  /** Data-space value (e.g. 1000). */
  value: number;
  /** Pixel position along the axis. */
  px: number;
  /** Display-space position in [0,1]-ish (transform output). */
  display: number;
  label: string;
  major: boolean;
}

export interface AxisOptions {
  /** Visible data range. */
  dataMin: number;
  dataMax: number;
  /** Pixel extent the axis spans. */
  pxStart: number;
  pxEnd: number;
  /** Include 2..9 ×10^k minor ticks (unlabeled). Default true. */
  minorTicks?: boolean;
}

function formatDecade(value: number): string {
  if (value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  const exp = Math.round(Math.log10(Math.abs(value)));
  const sup = String(exp)
    .split("")
    .map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)] ?? c)
    .join("");
  return `${sign}10${sup}`;
}

export function axisTicks(t: Transform, opts: AxisOptions): Tick[] {
  const { dataMin, dataMax, pxStart, pxEnd } = opts;
  const minor = opts.minorTicks ?? true;

  const sMin = t.scale(dataMin);
  const sMax = t.scale(dataMax);
  const span = sMax - sMin || 1;
  const toPx = (display: number) =>
    pxStart + ((display - sMin) / span) * (pxEnd - pxStart);

  const maxAbs = Math.max(Math.abs(dataMin), Math.abs(dataMax), 1);
  const maxExp = Math.ceil(Math.log10(maxAbs));

  const ticks: Tick[] = [];
  const push = (value: number, major: boolean) => {
    if (value < dataMin || value > dataMax) return;
    const display = t.scale(value);
    ticks.push({
      value,
      display,
      px: toPx(display),
      label: major ? formatDecade(value) : "",
      major,
    });
  };

  // Zero (logicle/asinh place it inside the linear region).
  if (dataMin <= 0 && dataMax >= 0) push(0, true);

  for (let exp = 0; exp <= maxExp; exp++) {
    const decade = 10 ** exp;
    for (const sign of [1, -1]) {
      push(sign * decade, true);
      if (minor) {
        for (let m = 2; m <= 9; m++) push(sign * m * decade, false);
      }
    }
  }

  ticks.sort((a, b) => a.value - b.value);
  return ticks;
}
