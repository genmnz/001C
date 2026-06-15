import {
  type ClusterResult,
  type EmbedResult,
  type EngineController,
} from "@joeee/engine-controller";
import { useState, type CSSProperties } from "react";
import type { Actions, Tab } from "./actions.ts";
import { ConsolePanel } from "./components/ConsolePanel.tsx";
import { EmbeddingPlot } from "./components/EmbeddingPlot.tsx";
import { GateTree } from "./components/GateTree.tsx";
import { HeatmapMock } from "./components/HeatmapMock.tsx";
import { MenuBar } from "./components/MenuBar.tsx";
import { OperationsPanel } from "./components/OperationsPanel.tsx";
import { PlotCanvas } from "./components/PlotCanvas.tsx";
import { ProjectsHub } from "./components/ProjectsHub.tsx";
import { StatsPanel } from "./components/StatsPanel.tsx";
import { StatsTable } from "./components/StatsTable.tsx";
import { synthClusters } from "./synth.ts";
import { useWorkspace } from "./useController.ts";

const SAMPLE = "demo.fcs";

export function App({ controller }: { controller: EngineController }) {
  const ws = useWorkspace(controller);
  const [page, setPage] = useState<"projects" | "workspace">("projects");
  const [tab, setTab] = useState<Tab>("density");
  const [log, setLog] = useState<string[]>([]);
  const [embedding, setEmbedding] = useState<EmbedResult | null>(null);
  const [clusters, setClusters] = useState<ClusterResult | null>(null);

  const addLog = (m: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 200));

  const xy = () => {
    const s = ws.activeSampleId ? ws.samples[ws.activeSampleId] : null;
    return { x: ws.axes.x || s?.channels[0]?.name || "", y: ws.axes.y || s?.channels[1]?.name || "" };
  };

  const actions: Actions = {
    openDemo: async () => {
      const { channels, columns } = synthClusters();
      await controller.addSampleFromColumns(SAMPLE, channels, columns);
      controller.setTransform({ kind: "logicle", T: 262144, W: 0.5, M: 4.5, A: 0 });
      addLog(`Loaded ${SAMPLE} (80,000 events, ${channels.length} channels)`);
      setPage("workspace");
    },
    home: () => setPage("projects"),
    compensate: async () => {
      try {
        await controller.compensate({ channels: ["FSC-A", "CD3"], values: [1, 0.12, 0.05, 1] });
        addLog("Compensation applied (demo spillover)");
      } catch (e) {
        addLog(`compensate: ${String(e)}`);
      }
    },
    addPolygon: async () => {
      const { x, y } = xy();
      const g = await controller.addGate(
        { kind: "polygon", xChannel: x, yChannel: y, vertices: [[0.55, 0.55], [0.95, 0.55], [0.95, 0.95], [0.55, 0.95]] },
        { name: "Upper-right" },
      );
      await controller.refreshStats(g.id, y);
      addLog(`Gate "${g.name}": ${g.count.toLocaleString()} events`);
    },
    cluster: async (method) => {
      const r = await controller.cluster(method, 8, { downsampleTo: 2000, seed: 1 });
      setClusters(r);
      setTab("embedding");
      addLog(`${method}: ${r.clusterCount} clusters over ${r.labels.length.toLocaleString()} events`);
    },
    embed: async (method) => {
      const r = await controller.embed(method, { maxPoints: 2000, seed: 1 });
      setEmbedding(r);
      setTab("embedding");
      addLog(`${method.toUpperCase()}: embedded ${r.points.length.toLocaleString()} events`);
    },
    computeStats: async () => {
      const { y } = xy();
      for (const g of controller.store.get().gates) await controller.refreshStats(g.id, y);
      setTab("stats");
      addLog(`Computed stats for ${controller.store.get().gates.length} gate(s)`);
    },
    exportWorkspace: () => {
      const doc = controller.exportWorkspace();
      addLog(`Exported workspace JSON (${doc.gates.length} gates, ${doc.samples.length} samples)`);
    },
    exportCsv: () => addLog("Export gated CSV — engine op core/sample.exportCsv (wire to download)"),
    importGatingML: async () => {
      const { x, y } = xy();
      const xml = `<gating:Gating-ML xmlns:gating="g" xmlns:data-type="d"><gating:RectangleGate gating:id="imp">
        <gating:dimension gating:min="0.5" gating:max="1"><data-type:fcs-dimension data-type:name="${x}"/></gating:dimension>
        <gating:dimension gating:min="0.5" gating:max="1"><data-type:fcs-dimension data-type:name="${y}"/></gating:dimension>
        </gating:RectangleGate></gating:Gating-ML>`;
      const n = await controller.importGatingML(xml);
      addLog(`Imported ${n} gate(s) from Gating-ML`);
    },
    setTransform: (kind) => {
      controller.setTransform(
        kind === "logicle" ? { kind: "logicle" } : kind === "asinh" ? { kind: "asinh" } : { kind: "linear", T: 262144 },
      );
      addLog(`Transform: ${kind}`);
    },
    undo: () => {
      addLog(controller.undo() ? "Undo" : "nothing to undo");
    },
    redo: () => {
      addLog(controller.redo() ? "Redo" : "nothing to redo");
    },
    setTab,
  };

  if (page === "projects") return <ProjectsHub onOpen={actions.openDemo} />;

  const sample = ws.activeSampleId ? ws.samples[ws.activeSampleId] : null;
  return (
    <div style={shell}>
      <MenuBar actions={actions} canUndo={controller.canUndo()} canRedo={controller.canRedo()} />
      <div style={body}>
        <OperationsPanel actions={actions} ws={ws} />
        <div style={center}>
          <div style={tabBar}>
            {(["density", "embedding", "heatmap", "stats"] as Tab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} style={tabBtn(tab === t)}>
                {t}
              </button>
            ))}
            <span style={statusText}>
              {sample ? `${sample.name} · ${sample.eventCount.toLocaleString()} events` : "no sample"}
              {sample?.compensated ? " · compensated" : ""} · {ws.status}
            </span>
          </div>
          <div style={stage}>
            {tab === "density" && <PlotCanvas controller={controller} />}
            {tab === "embedding" && <EmbeddingPlot embedding={embedding} clusters={clusters} />}
            {tab === "heatmap" && <HeatmapMock clusters={clusters} />}
            {tab === "stats" && <StatsTable controller={controller} />}
          </div>
        </div>
        <aside style={inspector}>
          <GateTree controller={controller} />
          <StatsPanel controller={controller} />
        </aside>
      </div>
      <ConsolePanel log={log} />
    </div>
  );
}

const shell: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto 1fr 170px",
  height: "100vh",
  fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  color: "#1d1d1f",
  background: "#f5f5f7",
};
const body: CSSProperties = { display: "grid", gridTemplateColumns: "230px 1fr 300px", minHeight: 0 };
const center: CSSProperties = { display: "flex", flexDirection: "column", minWidth: 0, borderLeft: "1px solid #d8d8dc", borderRight: "1px solid #d8d8dc" };
const tabBar: CSSProperties = { display: "flex", gap: 4, padding: "6px 8px", borderBottom: "1px solid #d8d8dc", background: "#fff", alignItems: "center" };
const stage: CSSProperties = { flex: 1, display: "grid", placeItems: "center", overflow: "auto", padding: 12 };
const inspector: CSSProperties = { background: "#ececef", padding: 12, overflow: "auto" };
const statusText: CSSProperties = { marginLeft: "auto", fontSize: 11, color: "#6e6e73" };
const tabBtn = (active: boolean): CSSProperties => ({
  font: "inherit",
  fontSize: 12,
  textTransform: "capitalize",
  padding: "4px 12px",
  borderRadius: 6,
  border: "1px solid #d8d8dc",
  background: active ? "#0a84ff" : "#fff",
  color: active ? "#fff" : "#1d1d1f",
  cursor: "pointer",
});
