import { buildTransform, type EngineController } from "@joeee/engine-controller";
import { Canvas2DRenderer, axisTicks } from "@joeee/cytometry-gpu";
import { useEffect, useRef } from "react";
import { useWorkspace } from "../useController.ts";

const W = 520;
const H = 520;

/**
 * The plot. Holds a canvas + a renderer in refs (never in React state), asks the
 * controller for density bins on every axis/transform/gate change, and hands
 * them straight to the renderer. Axis ticks come from the engine's transform via
 * the logicle-aware axisTicks. Uses Canvas2D so it works without WebGPU; swap in
 * WebGPUDensityRenderer for the fast path.
 */
export function PlotCanvas({ controller }: { controller: EngineController }) {
  const ws = useWorkspace(controller);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new Canvas2DRenderer(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    if (!ws.activeSampleId || !rendererRef.current) return;
    let cancelled = false;
    void controller
      .density({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, W, H)
      .then((bins) => {
        if (!cancelled) rendererRef.current?.drawDensity(bins, "viridis", "log");
      });
    return () => {
      cancelled = true;
    };
    // Re-render when axes, transform, or the gate set change.
  }, [controller, ws.activeSampleId, ws.axes.x, ws.axes.y, ws.transform, ws.gates.length]);

  const t = buildTransform(ws.transform);
  const ticks = ws.activeSampleId
    ? axisTicks(t, {
        dataMin: t.unscale(0),
        dataMax: t.unscale(1),
        pxStart: 0,
        pxEnd: W,
        minorTicks: false,
      }).filter((tk) => tk.major)
    : [];

  return (
    <div style={{ position: "relative", width: W, height: H + 24 }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ background: "#fff", border: "1px solid #d8d8dc", borderRadius: 4 }}
      />
      <svg width={W} height={24} style={{ display: "block" }}>
        {ticks.map((tk, i) => (
          <g key={i} transform={`translate(${tk.px},0)`}>
            <line y1={0} y2={4} stroke="#8e8e93" />
            <text y={16} fontSize={10} textAnchor="middle" fill="#6e6e73">
              {tk.label}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ position: "absolute", top: 8, left: 8, fontSize: 11, color: "#6e6e73" }}>
        {ws.axes.x} × {ws.axes.y} · logicle
      </div>
    </div>
  );
}
