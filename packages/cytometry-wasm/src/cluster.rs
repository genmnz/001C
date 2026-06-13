//! K-means assignment — the hot loop of Lloyd's algorithm, mirroring the assign
//! step of @joeee/cytometry-core's kmeans. Row-major points (n*d) and centroids
//! (k*d); writes the nearest-centroid index per point. In WASM with `+simd128`
//! the inner distance loop vectorizes.

pub fn assign_nearest(
    points: &[f32],
    centroids: &[f32],
    n: usize,
    d: usize,
    k: usize,
    out: &mut [i32],
) {
    for p in 0..n {
        let base = p * d;
        let mut best = 0i32;
        let mut best_d = f32::INFINITY;
        for c in 0..k {
            let cbase = c * d;
            let mut s = 0f32;
            for j in 0..d {
                let dv = points[base + j] - centroids[cbase + j];
                s += dv * dv;
            }
            if s < best_d {
                best_d = s;
                best = c as i32;
            }
        }
        out[p] = best;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assigns_to_nearest_centroid() {
        // 4 points in 2D, 2 centroids at (0,0) and (10,10).
        let points = [0.0f32, 0.0, 1.0, 1.0, 9.0, 9.0, 11.0, 8.0];
        let centroids = [0.0f32, 0.0, 10.0, 10.0];
        let mut out = [9i32; 4];
        assign_nearest(&points, &centroids, 4, 2, 2, &mut out);
        assert_eq!(out, [0, 0, 1, 1]);
    }
}
