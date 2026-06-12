// Instanced point scatter. One instance per event; a unit quad is expanded
// around each event position and clipped to a disc in the fragment stage. The
// world->clip transform happens here (on the GPU), not on the CPU — per the
// de-risking guidance, keep per-event transforms off the main thread.

struct Viewport { xMin: f32, xMax: f32, yMin: f32, yMax: f32 };

@group(0) @binding(0) var<uniform> vp: Viewport;
// pointSize in clip-space half-extents (x,y); color is RGBA.
@group(0) @binding(1) var<uniform> pointSize: vec2<f32>;
@group(0) @binding(2) var<uniform> color: vec4<f32>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@location(0) corner: vec2<f32>, @location(1) ev: vec2<f32>) -> VSOut {
  let nx = (ev.x - vp.xMin) / (vp.xMax - vp.xMin);
  let ny = (ev.y - vp.yMin) / (vp.yMax - vp.yMin);
  let center = vec2<f32>(nx * 2.0 - 1.0, ny * 2.0 - 1.0);
  var out: VSOut;
  out.pos = vec4<f32>(center + corner * pointSize, 0.0, 1.0);
  out.uv = corner;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  if (dot(in.uv, in.uv) > 1.0) { discard; }
  return color;
}
