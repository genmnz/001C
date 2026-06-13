import type { CSSProperties } from "react";
import type { EngineController } from "@joeee/engine-controller";
import { useWorkspace } from "../useController.ts";

export function StatsPanel({ controller }: { controller: EngineController }) {
  const ws = useWorkspace(controller);
  const entries = Object.entries(ws.stats);
  return (
    <section>
      <h2 style={hd}>Stats</h2>
      {entries.length === 0 ? (
        <p style={muted}>gate something to see stats</p>
      ) : (
        entries.map(([key, s]) => (
          <div key={key} style={{ fontSize: 12, marginBottom: 8 }}>
            <div style={{ color: "#6e6e73" }}>{key}</div>
            <div>
              median {s.median.toFixed(3)} · CV {s.cv.toFixed(1)}% ·{" "}
              {(100 * (s.ofParent ?? 0)).toFixed(1)}% of parent
            </div>
          </div>
        ))
      )}
    </section>
  );
}

const hd: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#6e6e73",
  margin: "16px 0 6px",
};
const muted: CSSProperties = { fontSize: 12, color: "#86868b" };
