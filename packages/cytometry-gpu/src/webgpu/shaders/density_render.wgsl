// Fullscreen colormap pass for the GPU density buffer. Renders a single
// triangle covering the viewport, samples the bin counts produced by
// histogram.wgsl, log-normalizes by the max bin, and applies a viridis colormap
// matching @joeee/cytometry-gpu's colormap.ts (CPU) anchor-for-anchor.

struct Params {
  binsX: u32,
  binsY: u32,
  maxCount: u32,
  _pad: u32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> bins: array<u32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
  // Oversized triangle covering clip space.
  let p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  return vec4<f32>(p[vi], 0.0, 1.0);
}

fn viridis(t: f32) -> vec3<f32> {
  // 5 anchors matching colormap.ts; linear segments.
  let c0 = vec3<f32>(68.0, 1.0, 84.0) / 255.0;
  let c1 = vec3<f32>(59.0, 82.0, 139.0) / 255.0;
  let c2 = vec3<f32>(33.0, 145.0, 140.0) / 255.0;
  let c3 = vec3<f32>(94.0, 201.0, 98.0) / 255.0;
  let c4 = vec3<f32>(253.0, 231.0, 37.0) / 255.0;
  let x = clamp(t, 0.0, 1.0) * 4.0;
  if (x < 1.0) { return mix(c0, c1, x); }
  if (x < 2.0) { return mix(c1, c2, x - 1.0); }
  if (x < 3.0) { return mix(c2, c3, x - 2.0); }
  return mix(c3, c4, x - 3.0);
}

@fragment
fn fs(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
  // frag.xy are pixel coords; map to bin indices (assumes canvas sized to bins).
  let ix = u32(frag.x);
  let iy = params.binsY - 1u - u32(frag.y); // flip Y to cytometry convention
  if (ix >= params.binsX || iy >= params.binsY) { discard; }
  let count = bins[iy * params.binsX + ix];
  if (count == 0u) { discard; }
  let t = log(1.0 + f32(count)) / log(1.0 + f32(params.maxCount));
  return vec4<f32>(viridis(t), 1.0);
}
