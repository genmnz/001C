import type { CSSProperties, ReactNode } from "react";
import type { WorkspaceState } from "@joeee/engine-controller";
import type { Actions } from "../actions.ts";

/** Left operations sidebar — the pipeline as buttons, grouped by stage. Each
 *  calls a controller operation via `actions`. */
export function OperationsPanel({ actions, ws }: { actions: Actions; ws: WorkspaceState }) {
  const transformKind = ws.transform.kind;
  return (
    <aside style={panel}>
      <Section title="Data">
        <Op onClick={() => void actions.openDemo()}>Reload demo sample</Op>
        <Op onClick={actions.exportCsv}>Export gated CSV</Op>
        <Op onClick={actions.exportWorkspace}>Export workspace</Op>
      </Section>

      <Section title="Compensation">
        <Op onClick={() => void actions.compensate()}>Apply compensation</Op>
      </Section>

      <Section title="Transform">
        {(["logicle", "asinh", "linear"] as const).map((k) => (
          <Op key={k} active={transformKind === k} onClick={() => actions.setTransform(k)}>
            {k}
          </Op>
        ))}
      </Section>

      <Section title="Gating">
        <Op onClick={() => void actions.addPolygon()}>+ Polygon gate</Op>
        <Op onClick={() => void actions.importGatingML()}>Import Gating-ML</Op>
        <div style={hint}>Rect-draw / pan-zoom: use the Density plot toolbar.</div>
      </Section>

      <Section title="Clustering">
        <Op onClick={() => void actions.cluster("kmeans")}>k-means</Op>
        <Op onClick={() => void actions.cluster("flowsom")}>FlowSOM</Op>
        <Op onClick={() => void actions.cluster("phenograph")}>PhenoGraph</Op>
      </Section>

      <Section title="Dim. reduction">
        <Op onClick={() => void actions.embed("pca")}>PCA</Op>
        <Op onClick={() => void actions.embed("umap")}>UMAP</Op>
        <Op onClick={() => void actions.embed("tsne")}>t-SNE</Op>
      </Section>

      <Section title="Statistics">
        <Op onClick={() => void actions.computeStats()}>Compute stats</Op>
      </Section>

      <Section title="History">
        <Op onClick={actions.undo}>Undo</Op>
        <Op onClick={actions.redo}>Redo</Op>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}

function Op({
  children,
  onClick,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} style={opBtn(!!active)}>
      {children}
    </button>
  );
}

const panel: CSSProperties = { background: "#ececef", padding: 12, overflow: "auto" };
const sectionTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#6e6e73",
  margin: "0 0 6px",
};
const opBtn = (active: boolean): CSSProperties => ({
  font: "inherit",
  fontSize: 12,
  textAlign: "left",
  textTransform: "capitalize",
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #d8d8dc",
  background: active ? "#0a84ff" : "#fff",
  color: active ? "#fff" : "#1d1d1f",
  cursor: "pointer",
});
const hint: CSSProperties = { fontSize: 10, color: "#86868b", padding: "2px 2px" };
