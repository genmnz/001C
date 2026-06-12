//! Point-in-polygon — a Rust mirror of the ray-casting kernel in
//! @joeee/cytometry-core/src/gating/polygon.ts. This is the hot loop on a gate
//! drag; in WASM with `+simd128` the inner test vectorizes over events.

/// Even-odd ray-casting test. `poly_x`/`poly_y` are the polygon vertices.
pub fn point_in_polygon(poly_x: &[f64], poly_y: &[f64], px: f64, py: f64) -> bool {
    let n = poly_x.len();
    if n < 3 {
        return false;
    }
    let mut inside = false;
    let mut j = n - 1;
    for i in 0..n {
        let yi = poly_y[i];
        let yj = poly_y[j];
        if (yi > py) != (yj > py) {
            let x_cross = (poly_x[j] - poly_x[i]) * (py - yi) / (yj - yi) + poly_x[i];
            if px < x_cross {
                inside = !inside;
            }
        }
        j = i;
    }
    inside
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn square_membership() {
        let xs = [0.0, 10.0, 10.0, 0.0];
        let ys = [0.0, 0.0, 10.0, 10.0];
        assert!(point_in_polygon(&xs, &ys, 5.0, 5.0));
        assert!(!point_in_polygon(&xs, &ys, -1.0, 5.0));
        assert!(!point_in_polygon(&xs, &ys, 11.0, 5.0));
    }

    #[test]
    fn concave_notch() {
        let xs = [0.0, 10.0, 10.0, 5.0, 0.0];
        let ys = [0.0, 0.0, 10.0, 4.0, 10.0];
        assert!(point_in_polygon(&xs, &ys, 5.0, 1.0));
        assert!(!point_in_polygon(&xs, &ys, 5.0, 8.0));
    }
}
