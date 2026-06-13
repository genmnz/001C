/**
 * Marching squares — extract iso-contour line segments from a scalar field
 * (e.g. a 2D density histogram) at a threshold. Public algorithm; output matches
 * d3-contour's segment geometry (linear edge interpolation). Feeds contour/
 * density plots and is the data-side counterpart the GPU/UI draws.
 *
 * `field` is row-major width*height. Coordinates are in grid units; cell (x,y)
 * has corners field[(y)*w+x] (TL), +1 (TR), +(w+1) (BR), +w (BL).
 */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function marchingSquares(
  field: ArrayLike<number>,
  width: number,
  height: number,
  threshold: number,
): Segment[] {
  const segs: Segment[] = [];
  const t = threshold;
  const interp = (va: number, vb: number) => {
    const denom = vb - va;
    return denom === 0 ? 0.5 : (t - va) / denom;
  };

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = field[y * width + x]; // TL
      const b = field[y * width + x + 1]; // TR
      const c = field[(y + 1) * width + x + 1]; // BR
      const d = field[(y + 1) * width + x]; // BL
      const idx =
        (a >= t ? 8 : 0) | (b >= t ? 4 : 0) | (c >= t ? 2 : 0) | (d >= t ? 1 : 0);
      if (idx === 0 || idx === 15) continue;

      // Edge crossing points (only computed where needed).
      const top = { x: x + interp(a, b), y };
      const right = { x: x + 1, y: y + interp(b, c) };
      const bottom = { x: x + interp(d, c), y: y + 1 };
      const left = { x, y: y + interp(a, d) };
      const seg = (p: { x: number; y: number }, q: { x: number; y: number }) =>
        segs.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });

      switch (idx) {
        case 1: // d
          seg(left, bottom);
          break;
        case 2: // c
          seg(bottom, right);
          break;
        case 3: // c,d
          seg(left, right);
          break;
        case 4: // b
          seg(top, right);
          break;
        case 5: // b,d (saddle)
          seg(left, top);
          seg(bottom, right);
          break;
        case 6: // b,c
          seg(top, bottom);
          break;
        case 7: // b,c,d
          seg(left, top);
          break;
        case 8: // a
          seg(top, left);
          break;
        case 9: // a,d
          seg(top, bottom);
          break;
        case 10: // a,c (saddle)
          seg(top, right);
          seg(bottom, left);
          break;
        case 11: // a,c,d
          seg(top, right);
          break;
        case 12: // a,b
          seg(left, right);
          break;
        case 13: // a,b,d
          seg(bottom, right);
          break;
        case 14: // a,b,c
          seg(left, bottom);
          break;
      }
    }
  }
  return segs;
}
