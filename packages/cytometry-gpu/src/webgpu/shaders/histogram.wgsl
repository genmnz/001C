// GPU 2D-histogram density. A compute pass bins every event into a storage
// buffer of atomic counters; the SAME buffer is then bound (read-only) by the
// density render pass — no CPU round-trip. This is the buffer-sharing pattern
// that lets pan/zoom re-bin millions of events at interactive rates. The bin
// math is identical to @joeee/cytometry-core's histogram2d (the headless source
// of truth), so GPU and CPU agree.

struct Params {
  binsX: u32,
  binsY: u32,
  count: u32,
  _pad: u32,
  xMin: f32,
  xMax: f32,
  yMin: f32,
  yMax: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> events: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> bins: array<atomic<u32>>;

@compute @workgroup_size(256)
fn clearBins(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i < params.binsX * params.binsY) {
    atomicStore(&bins[i], 0u);
  }
}

@compute @workgroup_size(256)
fn binEvents(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let e = events[i];
  if (e.x < params.xMin || e.x >= params.xMax ||
      e.y < params.yMin || e.y >= params.yMax) { return; }
  let fx = (e.x - params.xMin) / (params.xMax - params.xMin);
  let fy = (e.y - params.yMin) / (params.yMax - params.yMin);
  let ix = u32(fx * f32(params.binsX));
  let iy = u32(fy * f32(params.binsY));
  atomicAdd(&bins[iy * params.binsX + ix], 1u);
}
