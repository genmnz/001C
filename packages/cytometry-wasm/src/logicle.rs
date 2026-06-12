//! Logicle transform — a faithful Rust mirror of
//! @joeee/cytometry-core/src/transforms/logicle.ts (Moore & Parks 2012). Kept
//! algorithmically identical so the TS reference and the WASM kernel agree to
//! ~1e-6; the TS tests and these tests assert the same anchors and round-trips.

use core::f64::consts::LN_10;

const TAYLOR_LENGTH: usize = 16;

/// Solve for biexponential `d` given `b` and normalized width `w` (RTSAFE).
pub fn solve_d(b: f64, w: f64) -> f64 {
    if w == 0.0 {
        return b;
    }
    let tolerance = 2.0 * b * f64::EPSILON;
    let mut d_lo = 0.0;
    let mut d_hi = b;
    let f_const = -2.0 * b.ln() + w * b;
    let mut d = 0.5 * (d_lo + d_hi);
    let mut last_delta = d_hi - d_lo;
    let mut f = 2.0 * d.ln() + w * d + f_const;

    for _ in 0..40 {
        let df = 2.0 / d + w;
        let delta;
        if ((d - d_hi) * df - f) * ((d - d_lo) * df - f) >= 0.0
            || (1.9 * f).abs() > (last_delta * df).abs()
        {
            delta = 0.5 * (d_hi - d_lo);
            let d_new = d_lo + delta;
            if d_new == d_lo {
                return d_new;
            }
            d = d_new;
        } else {
            delta = f / df;
            let prev = d;
            d -= delta;
            if d == prev {
                return d;
            }
        }
        if delta.abs() < tolerance {
            return d;
        }
        last_delta = delta;
        f = 2.0 * d.ln() + w * d + f_const;
        if f < 0.0 {
            d_lo = d;
        } else {
            d_hi = d;
        }
    }
    d
}

pub struct Logicle {
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    f: f64,
    x1: f64,
    x_taylor: f64,
    taylor: [f64; TAYLOR_LENGTH],
}

impl Logicle {
    pub fn new(t: f64, w: f64, m: f64, a: f64) -> Logicle {
        assert!(t > 0.0 && w >= 0.0 && m > 0.0, "logicle: bad T/W/M");
        assert!(w <= m / 2.0, "logicle: W must be <= M/2");
        assert!(a >= -w && a <= m - 2.0 * w, "logicle: A out of range");

        let wn = w / (m + a);
        let x2 = a / (m + a);
        let x1 = x2 + wn;
        let x0 = x2 + 2.0 * wn;
        let b = (m + a) * LN_10;
        let d = solve_d(b, wn);

        let c_a = (x0 * (b + d)).exp();
        let mf_a = (b * x1).exp() - c_a / (d * x1).exp();
        let a_coef = t / (b.exp() - mf_a - c_a / d.exp());
        let c = c_a * a_coef;
        let f = -mf_a * a_coef;

        let x_taylor = x1 + wn / 4.0;
        let mut pos = a_coef * (b * x1).exp();
        let mut neg = -c * (-d * x1).exp();
        let mut taylor = [0.0f64; TAYLOR_LENGTH];
        for i in 0..TAYLOR_LENGTH {
            pos *= b / (i as f64 + 1.0);
            neg *= -d / (i as f64 + 1.0);
            taylor[i] = pos + neg;
        }

        Logicle { a: a_coef, b, c, d, f, x1, x_taylor, taylor }
    }

    fn series(&self, scale: f64) -> f64 {
        let t = scale - self.x1;
        let mut sum = self.taylor[TAYLOR_LENGTH - 1];
        for i in (0..TAYLOR_LENGTH - 1).rev() {
            sum = sum * t + self.taylor[i];
        }
        sum * t
    }

    fn eval_b(&self, x: f64) -> f64 {
        if x < self.x_taylor {
            self.series(x)
        } else {
            self.a * (self.b * x).exp() + self.f - self.c * (-self.d * x).exp()
        }
    }

    fn eval_bprime(&self, x: f64) -> f64 {
        self.a * self.b * (self.b * x).exp() + self.c * self.d * (-self.d * x).exp()
    }

    pub fn unscale(&self, scale: f64) -> f64 {
        let negative = scale < self.x1;
        let x = if negative { 2.0 * self.x1 - scale } else { scale };
        let v = self.eval_b(x);
        if negative {
            -v
        } else {
            v
        }
    }

    pub fn scale(&self, value: f64) -> f64 {
        if value == 0.0 {
            return self.x1;
        }
        let negative = value < 0.0;
        let v = value.abs();

        let mut lo = self.x1;
        let mut hi = 1.0;
        while self.eval_b(hi) < v && hi < 64.0 {
            hi *= 2.0;
        }

        let mut x = 0.5 * (lo + hi);
        let mut dx_old = hi - lo;
        let mut dx = dx_old;
        let mut fx = self.eval_b(x) - v;
        let mut dfx = self.eval_bprime(x);
        let tol = 1e-13;

        for _ in 0..60 {
            if ((x - hi) * dfx - fx) * ((x - lo) * dfx - fx) > 0.0
                || (2.0 * fx).abs() > (dx_old * dfx).abs()
            {
                dx_old = dx;
                dx = 0.5 * (hi - lo);
                x = lo + dx;
                if lo == x {
                    break;
                }
            } else {
                dx_old = dx;
                dx = fx / dfx;
                let prev = x;
                x -= dx;
                if prev == x {
                    break;
                }
            }
            if dx.abs() < tol {
                break;
            }
            fx = self.eval_b(x) - v;
            dfx = self.eval_bprime(x);
            if fx < 0.0 {
                lo = x;
            } else {
                hi = x;
            }
        }
        if negative {
            2.0 * self.x1 - x
        } else {
            x
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anchors_and_roundtrip() {
        let lg = Logicle::new(262144.0, 0.5, 4.5, 0.0);
        // Same analytic anchors the TS suite asserts.
        assert!((lg.scale(262144.0) - 1.0).abs() < 1e-6);
        assert!(lg.unscale(lg.scale(0.0)).abs() < 1e-6);
        for v in [-5000.0, -10.0, 0.0, 1.0, 100.0, 10000.0, 262144.0] {
            let back = lg.unscale(lg.scale(v));
            let tol = (v.abs() * 1e-5).max(1e-4);
            assert!((back - v).abs() < tol, "roundtrip failed at {v}: {back}");
        }
    }

    #[test]
    fn monotonic() {
        let lg = Logicle::new(262144.0, 0.5, 4.5, 0.0);
        let mut prev = f64::NEG_INFINITY;
        let mut v = -10000.0;
        while v <= 262144.0 {
            let s = lg.scale(v);
            assert!(s > prev, "not monotonic at {v}");
            prev = s;
            v += 997.0;
        }
    }
}
