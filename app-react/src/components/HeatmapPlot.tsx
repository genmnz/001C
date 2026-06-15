import type { CSSProperties } from "react";
import type { EnrichmentResult } from "@joeee/engine-controller";

/** Real cluster × marker enrichment heatmap (z-scores from
 *  core/discovery.markerEnrichment via the controller). Diverging blue-white-red. */
export function HeatmapPlot({ data }: { data: EnrichmentResult | null }) {
  if (!data) {
    return (
      <div style={{ color: "#86868b", fontSize: 13, maxWidth: 360, textAlign: "center" }}>
        Run “Cluster heatmap” (Statistics) to compute per-cluster marker
        enrichment z-scores.
      </div>
    );
  }
  const color = (z: number) => {
    const t = Math.max(-3, Math.min(3, z)) / 3; // -1..1
    const r = t > 0 ? 255 : Math.round(255 * (1 + t));
    const b = t < 0 ? 255 : Math.round(255 * (1 - t));
    const g = Math.round(255 * (1 - Math.abs(t)));
    return `rgb(${r},${g},${b})`;
  };
  return (
    <div>
      <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={th} />
            {data.markers.map((m) => (
              <th key={m} style={th}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.z.map((row, r) => (
            <tr key={r}>
              <td style={rowLabel}>cl {r}</td>
              {row.map((z, c) => (
                <td key={c} style={{ ...cell, background: color(z) }} title={z.toFixed(2)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: "#6e6e73", marginTop: 8 }}>
        {data.clusterCount} clusters · z-score (blue = low, red = high)
      </div>
    </div>
  );
}

const th: CSSProperties = { fontSize: 10, color: "#6e6e73", fontWeight: 600, padding: "2px 4px", textAlign: "center", whiteSpace: "nowrap" };
const rowLabel: CSSProperties = { fontSize: 10, color: "#6e6e73", padding: "2px 6px", textAlign: "right" };
const cell: CSSProperties = { width: 40, height: 22, border: "1px solid #fff" };
