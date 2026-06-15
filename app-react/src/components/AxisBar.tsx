import type { CSSProperties } from "react";
import type { EngineController } from "@joeee/engine-controller";
import { useWorkspace } from "../useController.ts";

/** X/Y channel selectors for the density plot — wired to controller.setAxes. */
export function AxisBar({ controller }: { controller: EngineController }) {
  const ws = useWorkspace(controller);
  const sample = ws.activeSampleId ? ws.samples[ws.activeSampleId] : null;
  if (!sample) return null;
  const names = sample.channels.map((c) => c.name);
  return (
    <div style={bar}>
      <label style={lab}>
        X{" "}
        <select value={ws.axes.x} onChange={(e) => controller.setAxes(e.target.value, ws.axes.y)} style={sel}>
          {names.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <label style={lab}>
        Y{" "}
        <select value={ws.axes.y} onChange={(e) => controller.setAxes(ws.axes.x, e.target.value)} style={sel}>
          {names.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <span style={{ fontSize: 11, color: "#6e6e73" }}>transform: {ws.transform.kind}</span>
    </div>
  );
}

const bar: CSSProperties = { display: "flex", gap: 12, alignItems: "center", marginBottom: 8 };
const lab: CSSProperties = { fontSize: 12, color: "#1d1d1f" };
const sel: CSSProperties = { font: "inherit", fontSize: 12, padding: "2px 4px" };
