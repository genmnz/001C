/**
 * Perceptually-uniform colormaps as pure functions, so density coloring is
 * identical on the GPU (the same anchors are encoded in colormap.wgsl) and on
 * the Canvas2D fallback, and is unit-testable. `t` is clamped to [0,1].
 */
export type Rgb = [number, number, number];

const VIRIDIS: Array<[number, Rgb]> = [
  [0.0, [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.5, [33, 145, 140]],
  [0.75, [94, 201, 98]],
  [1.0, [253, 231, 37]],
];

const INFERNO: Array<[number, Rgb]> = [
  [0.0, [0, 0, 4]],
  [0.25, [87, 16, 110]],
  [0.5, [188, 55, 84]],
  [0.75, [249, 142, 9]],
  [1.0, [252, 255, 164]],
];

const MAPS: Record<string, Array<[number, Rgb]>> = {
  viridis: VIRIDIS,
  inferno: INFERNO,
};

export function sampleColormap(name: string, t: number): Rgb {
  const stops = MAPS[name] ?? VIRIDIS;
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (x - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

export function colormapNames(): string[] {
  return Object.keys(MAPS);
}
