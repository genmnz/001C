import type { EngineController } from "@joeee/engine-controller";
import { useEffect } from "react";
import { GateTree } from "./components/GateTree.tsx";
import { PlotCanvas } from "./components/PlotCanvas.tsx";
import { StatsPanel } from "./components/StatsPanel.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import { synthClusters } from "./synth.ts";
import { useWorkspace } from "./useController.ts";

export function App({ controller }: { controller: EngineController }) {
  const ws = useWorkspace(controller);

  useEffect(() => {
    const { channels, columns } = synthClusters();
    void controller.addSampleFromColumns("demo.fcs", channels, columns).then(() => {
      controller.setTransform({ kind: "logicle", T: 262144, W: 0.5, M: 4.5, A: 0 });
    });
  }, [controller]);

  const sample = ws.activeSampleId ? ws.samples[ws.activeSampleId] : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        height: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        color: "#1d1d1f",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Toolbar controller={controller} />
        <div style={{ flex: 1, display: "grid", placeItems: "center", background: "#f5f5f7" }}>
          <PlotCanvas controller={controller} />
        </div>
      </div>
      <aside style={{ borderLeft: "1px solid #d8d8dc", background: "#ececef", padding: 16, overflow: "auto" }}>
        <h1 style={{ fontSize: 15, margin: "0 0 4px" }}>joeee · React</h1>
        <p style={{ fontSize: 12, color: "#6e6e73", marginTop: 0 }}>
          {sample
            ? `${sample.name} · ${sample.eventCount.toLocaleString()} events · ${sample.channels.length} channels`
            : "loading…"}
        </p>
        <GateTree controller={controller} />
        <StatsPanel controller={controller} />
      </aside>
    </div>
  );
}
