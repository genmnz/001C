//! joeee-cytometry-wasm — the small Rust surface the de-risking plan recommends
//! porting (NOT the whole engine): logicle/biexponential, point-in-polygon
//! gating, and spillover inversion. Everything else stays in TypeScript.
//!
//! These kernels are exposed over a raw C ABI rather than wasm-bindgen: JS calls
//! the exported functions with pointers into the wasm linear memory. That keeps
//! the crate dependency-free (so `cargo test` runs offline and these tests prove
//! the Rust mirrors the TS) and avoids a bindgen toolchain. Build the wasm with:
//!
//!   rustup target add wasm32-unknown-unknown
//!   RUSTFLAGS="-C target-feature=+simd128" \
//!     cargo build --release --target wasm32-unknown-unknown
//!
//! IMPORTANT (see docs/DERISKING.md): the big event matrix must NOT be copied
//! into this module's heap — at 30M x 50 (~6 GB) it would blow the wasm32 4 GB
//! ceiling (Memory64 is still absent from Safari in 2026). Instead, keep the
//! matrix in a JS SharedArrayBuffer and pass slice pointers into these kernels.

pub mod cluster;
pub mod compensate;
pub mod gate;
pub mod logicle;

use core::slice;

/// Apply the logicle scale to a Float32 column in place. `ptr`/`len` address the
/// column in wasm linear memory (a view over the shared buffer).
///
/// # Safety
/// `ptr` must point to `len` valid, writable f32 values.
#[no_mangle]
pub unsafe extern "C" fn logicle_scale_into(
    ptr: *mut f32,
    len: usize,
    t: f64,
    w: f64,
    m: f64,
    a: f64,
) {
    let lg = logicle::Logicle::new(t, w, m, a);
    let data = slice::from_raw_parts_mut(ptr, len);
    for v in data.iter_mut() {
        *v = lg.scale(*v as f64) as f32;
    }
}

/// Compute a polygon-membership mask (1/0 per event) over display-space columns.
///
/// # Safety
/// All pointers must address the stated number of valid elements.
#[no_mangle]
pub unsafe extern "C" fn polygon_mask(
    xs: *const f32,
    ys: *const f32,
    n: usize,
    poly_x: *const f64,
    poly_y: *const f64,
    poly_n: usize,
    out: *mut u8,
) {
    let xs = slice::from_raw_parts(xs, n);
    let ys = slice::from_raw_parts(ys, n);
    let px = slice::from_raw_parts(poly_x, poly_n);
    let py = slice::from_raw_parts(poly_y, poly_n);
    let out = slice::from_raw_parts_mut(out, n);
    for i in 0..n {
        out[i] = point_in(px, py, xs[i] as f64, ys[i] as f64);
    }
}

#[inline]
fn point_in(px: &[f64], py: &[f64], x: f64, y: f64) -> u8 {
    gate::point_in_polygon(px, py, x, y) as u8
}

/// K-means assignment over wasm linear memory (row-major points/centroids).
///
/// # Safety
/// All pointers must address the stated number of valid elements.
#[no_mangle]
pub unsafe extern "C" fn kmeans_assign(
    points: *const f32,
    centroids: *const f32,
    n: usize,
    d: usize,
    k: usize,
    out: *mut i32,
) {
    let pts = slice::from_raw_parts(points, n * d);
    let cts = slice::from_raw_parts(centroids, k * d);
    let o = slice::from_raw_parts_mut(out, n);
    cluster::assign_nearest(pts, cts, n, d, k, o);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logicle_scale_into_matches_struct() {
        let mut col = [1.0f32, 100.0, 10000.0, 262144.0];
        let lg = logicle::Logicle::new(262144.0, 0.5, 4.5, 0.0);
        let expected: Vec<f32> = col.iter().map(|&v| lg.scale(v as f64) as f32).collect();
        unsafe {
            logicle_scale_into(col.as_mut_ptr(), col.len(), 262144.0, 0.5, 4.5, 0.0);
        }
        for (a, b) in col.iter().zip(expected.iter()) {
            assert!((a - b).abs() < 1e-6);
        }
    }

    #[test]
    fn polygon_mask_marks_interior() {
        let xs = [5.0f32, -1.0, 11.0];
        let ys = [5.0f32, 5.0, 5.0];
        let poly_x = [0.0f64, 10.0, 10.0, 0.0];
        let poly_y = [0.0f64, 0.0, 10.0, 10.0];
        let mut out = [9u8; 3];
        unsafe {
            polygon_mask(
                xs.as_ptr(),
                ys.as_ptr(),
                3,
                poly_x.as_ptr(),
                poly_y.as_ptr(),
                4,
                out.as_mut_ptr(),
            );
        }
        assert_eq!(out, [1, 0, 0]);
    }
}
