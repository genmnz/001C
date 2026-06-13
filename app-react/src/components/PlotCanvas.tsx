import { buildTransform, type EngineController } from "@joeee/engine-controller";
import {
  Canvas2DRenderer,
  axisTicks,
  displayToScreen,
  panViewport,
  rectFromDrag,
  zoomViewport,
  type Viewport,
} from "@joeee/cytometry-gpu";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as RMouseEvent,
  type WheelEvent as RWheelEvent,
} from "react";
import { useWorkspace } from "../useController.ts";

const W = 520;
const H = 520;
const FULL: Viewport = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

type Drag =
  | { mode: "pan"; lastX: number; lastY: number }
  | { mode: "rect"; x0: number; y0: number; x1: number; y1: number };

/**
 * Interactive plot: pan (drag), zoom-about-cursor (wheel), and rectangle-gate
 * drawing — all built on the pure, fuzz-tested helpers in @joeee/cytometry-gpu.
 * Density bins are fetched from the controller on every view change and drawn by
 * the Canvas2D renderer; gates are an SVG overlay positioned via displayToScreen.
 * The canvas/renderer live in refs (never React state); only small view state
 * (viewport, mode) is React-held.
 */
export function PlotCanvas({ controller }: { controller: EngineController }) {
  const ws = useWorkspace(controller);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Canvas2DRenderer | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const [viewport, setViewport] = useState<Viewport>(FULL);
  const [mode, setMode] = useState<"pan" | "rect">("pan");
  const [preview, setPreview] = useState<Drag | null>(null);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new Canvas2DRenderer(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    if (!ws.activeSampleId || !rendererRef.current) return;
    let cancelled = false;
    void controller.density(viewport, W, H).then((bins) => {
      if (!cancelled) rendererRef.current?.drawDensity(bins, "viridis", "log");
    });
    return () => {
      cancelled = true;
    };
  }, [controller, ws.activeSampleId, ws.axes, ws.transform, ws.gates.length, viewport]);

  const local = (e: RMouseEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const onDown = (e: RMouseEvent) => {
    const [x, y] = local(e);
    dragRef.current =
      mode === "pan"
        ? { mode: "pan", lastX: x, lastY: y }
        : { mode: "rect", x0: x, y0: y, x1: x, y1: y };
    setPreview(dragRef.current);
  };

  const onMove = (e: RMouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const [x, y] = local(e);
    if (d.mode === "pan") {
      setViewport((vp) => panViewport(vp, x - d.lastX, y - d.lastY, W, H));
      d.lastX = x;
      d.lastY = y;
    } else {
      d.x1 = x;
      d.y1 = y;
      setPreview({ ...d });
    }
  };

  const onUp = async () => {
    const d = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    if (d?.mode === "rect" && (Math.abs(d.x1 - d.x0) > 3 || Math.abs(d.y1 - d.y0) > 3)) {
      const g = rectFromDrag(d.x0, d.y0, d.x1, d.y1, viewport, W, H);
      const node = await controller.addGate({
        kind: "rectangle",
        xChannel: ws.axes.x,
        yChannel: ws.axes.y,
        ...g,
      });
      await controller.refreshStats(node.id, ws.axes.y);
    }
  };

  const onWheel = (e: RWheelEvent) => {
    const [x, y] = local(e);
    setViewport((vp) => zoomViewport(vp, Math.exp(e.deltaY * 0.001), x, y, W, H));
  };

  const t = buildTransform(ws.transform);
  const ticks = ws.activeSampleId
    ? axisTicks(t, {
        dataMin: t.unscale(viewport.xMin),
        dataMax: t.unscale(viewport.xMax),
        pxStart: 0,
        pxEnd: W,
        minorTicks: false,
      }).filter((tk) => tk.major && tk.px >= 0 && tk.px <= W)
    : [];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, fontSize: 12 }}>
        <button type="button" onClick={() => setMode("pan")} style={tab(mode === "pan")}>
          Pan / zoom
        </button>
        <button type="button" onClick={() => setMode("rect")} style={tab(mode === "rect")}>
          Draw rect gate
        </button>
        <button type="button" onClick={() => setViewport(FULL)} style={tab(false)}>
          Reset view
        </button>
      </div>
      <div style={{ position: "relative", width: W, height: H }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            background: "#fff",
            border: "1px solid #d8d8dc",
            borderRadius: 4,
            cursor: mode === "rect" ? "crosshair" : "grab",
          }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onWheel={onWheel}
        />
        <svg
          width={W}
          height={H}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          {/* committed gates */}
          {ws.gates.map((node) => (
            <GateShape key={node.id} spec={node.spec} viewport={viewport} />
          ))}
          {/* in-progress rectangle */}
          {preview?.mode === "rect" && (
            <rect
              x={Math.min(preview.x0, preview.x1)}
              y={Math.min(preview.y0, preview.y1)}
              width={Math.abs(preview.x1 - preview.x0)}
              height={Math.abs(preview.y1 - preview.y0)}
              fill="rgba(10,132,255,0.12)"
              stroke="#0a84ff"
              strokeDasharray="4 3"
            />
          )}
        </svg>
      </div>
      <svg width={W} height={22}>
        {ticks.map((tk, i) => (
          <g key={i} transform={`translate(${tk.px},0)`}>
            <line y1={0} y2={4} stroke="#8e8e93" />
            <text y={15} fontSize={10} textAnchor="middle" fill="#6e6e73">
              {tk.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function GateShape({
  spec,
  viewport,
}: {
  spec: import("@joeee/engine-controller").GateSpec;
  viewport: Viewport;
}) {
  if (spec.kind === "rectangle") {
    const tl = displayToScreen(spec.xMin, spec.yMax, viewport, W, H);
    const br = displayToScreen(spec.xMax, spec.yMin, viewport, W, H);
    return (
      <rect
        x={tl.x}
        y={tl.y}
        width={br.x - tl.x}
        height={br.y - tl.y}
        fill="none"
        stroke="#ff453a"
        strokeWidth={1.5}
      />
    );
  }
  if (spec.kind === "polygon") {
    const pts = spec.vertices
      .map((v) => displayToScreen(v[0], v[1], viewport, W, H))
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
    return <polygon points={pts} fill="none" stroke="#ff453a" strokeWidth={1.5} />;
  }
  return null;
}

const tab = (active: boolean): CSSProperties => ({
  font: "inherit",
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #d8d8dc",
  background: active ? "#0a84ff" : "#fff",
  color: active ? "#fff" : "#1d1d1f",
  cursor: "pointer",
});
