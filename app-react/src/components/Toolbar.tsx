import type { CSSProperties } from "react";
import type { EngineController } from "@joeee/engine-controller";

/**
 * Commands only — the toolbar issues controller calls and never reads/holds
 * engine data. Adding a polygon gate exercises the point-in-polygon kernel
 * (TS or WASM) in the engine; the gate tree + stats update via the store.
 */
export function Toolbar({ controller }: { controller: EngineController }) {
  const addGate = async () => {
    const gate = await controller.addGate(
      {
        kind: "polygon",
        xChannel: "FSC-A",
        yChannel: "CD3",
        // Display (logicle) space — roughly the upper-right cluster.
        vertices: [
          [0.6, 0.6],
          [0.95, 0.6],
          [0.95, 0.95],
          [0.6, 0.95],
        ],
      },
      { name: "Upper-right" },
    );
    await controller.refreshStats(gate.id, "CD3");
  };

  const compensate = async () => {
    // Demo spillover on the synthetic channels (real samples use FCS $SPILLOVER).
    try {
      await controller.compensate({
        channels: ["FSC-A", "CD3"],
        values: [1.0, 0.12, 0.05, 1.0],
      });
    } catch {
      /* no active sample yet */
    }
  };

  return (
    <div
      style={{
        height: 44,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 12px",
        borderBottom: "1px solid #d8d8dc",
        background: "#fff",
      }}
    >
      <strong style={{ fontSize: 13 }}>joeee</strong>
      <button type="button" onClick={addGate} style={btn}>
        + Polygon gate
      </button>
      <button type="button" onClick={compensate} style={btn}>
        Compensate
      </button>
    </div>
  );
}

const btn: CSSProperties = {
  font: "inherit",
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #d8d8dc",
  background: "#fff",
  cursor: "pointer",
};
