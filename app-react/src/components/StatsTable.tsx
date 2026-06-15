import type { CSSProperties } from "react";
import type { EngineController } from "@joeee/engine-controller";
import { useWorkspace } from "../useController.ts";

/** Statistics view — the computed per-population numbers from the store. */
export function StatsTable({ controller }: { controller: EngineController }) {
  const ws = useWorkspace(controller);
  const entries = Object.entries(ws.stats);
  if (entries.length === 0) {
    return <div style={{ color: "#86868b", fontSize: 13 }}>Run “Compute stats” to populate this table.</div>;
  }
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 12, background: "#fff" }}>
      <thead>
        <tr>
          {["population : channel", "count", "median", "CV %", "% parent", "% total"].map((h) => (
            <th key={h} style={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, s]) => (
          <tr key={key}>
            <td style={tdL}>{key}</td>
            <td style={td}>{s.count.toLocaleString()}</td>
            <td style={td}>{s.median.toFixed(3)}</td>
            <td style={td}>{s.cv.toFixed(1)}</td>
            <td style={td}>{((s.ofParent ?? 0) * 100).toFixed(1)}</td>
            <td style={td}>{((s.ofTotal ?? 0) * 100).toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th: CSSProperties = { fontSize: 11, color: "#6e6e73", fontWeight: 600, padding: "4px 10px", borderBottom: "1px solid #d8d8dc", textAlign: "left" };
const td: CSSProperties = { padding: "4px 10px", borderBottom: "1px solid #eee", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const tdL: CSSProperties = { ...td, textAlign: "left", fontFamily: "SF Mono, Menlo, monospace", fontSize: 11 };
