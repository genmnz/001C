//! Spillover inversion — a Rust mirror of
//! @joeee/cytometry-core/src/compensation/invert.ts (Gauss-Jordan, f64). The
//! inverse multiplies millions of events, so precision matters; this stays f64.

/// Invert an n*n row-major matrix. Returns the inverse, or None if singular.
pub fn invert_square(m: &[f64], n: usize) -> Option<Vec<f64>> {
    if m.len() != n * n {
        return None;
    }
    let mut a = m.to_vec();
    let mut inv = vec![0.0f64; n * n];
    for i in 0..n {
        inv[i * n + i] = 1.0;
    }

    for col in 0..n {
        let mut pivot = col;
        let mut max = a[col * n + col].abs();
        for r in (col + 1)..n {
            let v = a[r * n + col].abs();
            if v > max {
                max = v;
                pivot = r;
            }
        }
        if max == 0.0 {
            return None;
        }
        if pivot != col {
            for j in 0..n {
                a.swap(col * n + j, pivot * n + j);
                inv.swap(col * n + j, pivot * n + j);
            }
        }
        let piv = a[col * n + col];
        for j in 0..n {
            a[col * n + j] /= piv;
            inv[col * n + j] /= piv;
        }
        for r in 0..n {
            if r == col {
                continue;
            }
            let factor = a[r * n + col];
            if factor == 0.0 {
                continue;
            }
            for j in 0..n {
                a[r * n + j] -= factor * a[col * n + j];
                inv[r * n + j] -= factor * inv[col * n + j];
            }
        }
    }
    Some(inv)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inverse_times_original_is_identity() {
        let n = 3;
        let a = [4.0, 3.0, 2.0, 1.0, 1.0, 1.0, 3.0, 2.0, 4.0];
        let inv = invert_square(&a, n).unwrap();
        for i in 0..n {
            for j in 0..n {
                let mut acc = 0.0;
                for k in 0..n {
                    acc += a[i * n + k] * inv[k * n + j];
                }
                let expect = if i == j { 1.0 } else { 0.0 };
                assert!((acc - expect).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn singular_returns_none() {
        let a = [1.0, 2.0, 3.0, 2.0, 4.0, 6.0, 7.0, 8.0, 9.0];
        assert!(invert_square(&a, 3).is_none());
    }
}
