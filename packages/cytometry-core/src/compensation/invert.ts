/**
 * Dense square matrix inversion via Gauss-Jordan elimination with partial
 * pivoting, in f64. Spillover matrices are small (NxN, N = number of stained
 * channels, typically <= ~50) but their inverse multiplies millions of events,
 * so the inverse itself must be accurate — hence f64 here even though event data
 * is rendered as f32 (see docs/DERISKING.md on precision).
 *
 * Matrices are row-major Float64Array of length n*n.
 */
export function invertSquare(m: Float64Array, n: number): Float64Array {
  if (m.length !== n * n) throw new Error("invertSquare: size mismatch");
  // Work on a copy augmented conceptually with identity (kept separate).
  const a = Float64Array.from(m);
  const inv = new Float64Array(n * n);
  for (let i = 0; i < n; i++) inv[i * n + i] = 1;

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the row (>= col) with the largest |a[row,col]|.
    let pivot = col;
    let max = Math.abs(a[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(a[r * n + col]);
      if (v > max) {
        max = v;
        pivot = r;
      }
    }
    if (max === 0) throw new Error("invertSquare: matrix is singular");
    if (pivot !== col) {
      swapRows(a, n, col, pivot);
      swapRows(inv, n, col, pivot);
    }
    // Normalize pivot row.
    const pivVal = a[col * n + col];
    for (let j = 0; j < n; j++) {
      a[col * n + j] /= pivVal;
      inv[col * n + j] /= pivVal;
    }
    // Eliminate this column from all other rows.
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r * n + col];
      if (factor === 0) continue;
      for (let j = 0; j < n; j++) {
        a[r * n + j] -= factor * a[col * n + j];
        inv[r * n + j] -= factor * inv[col * n + j];
      }
    }
  }
  return inv;
}

function swapRows(m: Float64Array, n: number, r1: number, r2: number): void {
  for (let j = 0; j < n; j++) {
    const tmp = m[r1 * n + j];
    m[r1 * n + j] = m[r2 * n + j];
    m[r2 * n + j] = tmp;
  }
}
