import type { CSSProperties } from "react";
import type { EngineController } from "@joeee/engine-controller";
import { useWorkspace } from "../useController.ts";

export function GateTree({ controller }: { controller: EngineController }) {
  const ws = useWorkspace(controller);
  return (
    <section>
      <h2 style={hd}>Gates</h2>
      {ws.gates.length === 0 ? (
        <p style={muted}>none yet</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {ws.gates.map((g) => (
            <li key={g.id} style={{ fontSize: 12, padding: "4px 0" }}>
              <span style={{ fontWeight: 600 }}>{g.name}</span>:{" "}
              {g.count.toLocaleString()} events
            </li>
          ))}
        </ul>
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
