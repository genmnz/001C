import type { CSSProperties } from "react";
import type { ClusterResult } from "@joeee/engine-controller";

const MARKERS = ["FSC-A", "SSC-A", "CD3", "CD4", "CD8", "CD19", "CD56", "CD14"];

/** Mock cluster × marker expression heatmap. Real values come from
 *  core/discovery.markerEnrichment once wired through the controller; the layout
 *  here is the placeholder visualization. */
export function HeatmapMock({ clusters }: { clusters: ClusterResult | null }) {
  const rows = clusters ? Math.min(clusters.clusterCount, 12) : 6;
  const value = (r: number, c: number) =>
    (Math.sin((r + 1) * 1.3 + (c + 1) * 0.7) * 0.5 + 0.5);
  const color = (v: number) => {
    // simple viridis-ish 3-stop ramp
    const stops = [
      [68, 1, 84],
      [33, 145, 140],
      [253, 231, 37],
    ];
    const t = v * 2;
    const i = t < 1 ? 0 : 1;
    const f = t - i;
    const a = stops[i];
    const b = stops[i + 1];
    return `rgb(${(a[0] + (b[0] - a[0]) * f) | 0},${(a[1] + (b[1] - a[1]) * f) | 0},${(a[2] + (b[2] - a[2]) * f) | 0})`;
  };

  return (
    <div>
      <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={th}></th>
            {MARKERS.map((m) => (
              <th key={m} style={th}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <td style={rowLabel}>cl {r}</td>
              {MARKERS.map((_, c) => (
                <td key={c} style={{ ...cell, background: color(value(r, c)) }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: "#6e6e73", marginTop: 8 }}>
        Cluster × marker heatmap (mock — wire core/discovery.markerEnrichment for real values)
      </div>
    </div>
  );
}

const th: CSSProperties = { fontSize: 10, color: "#6e6e73", fontWeight: 600, padding: "2px 4px", textAlign: "center" };
const rowLabel: CSSProperties = { fontSize: 10, color: "#6e6e73", padding: "2px 6px", textAlign: "right" };
const cell: CSSProperties = { width: 34, height: 22, border: "1px solid #fff" };
