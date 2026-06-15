import { useState, type CSSProperties } from "react";
import type { Actions } from "../actions.ts";

interface Item {
  label: string;
  on: () => void;
  disabled?: boolean;
}

export function MenuBar({
  actions,
  canUndo,
  canRedo,
}: {
  actions: Actions;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const menus: Record<string, Item[]> = {
    File: [
      { label: "New / Projects…", on: actions.home },
      { label: "Open demo project", on: () => void actions.openDemo() },
      { label: "Export workspace JSON", on: actions.exportWorkspace },
      { label: "Export gated CSV", on: actions.exportCsv },
      { label: "Import Gating-ML…", on: () => void actions.importGatingML() },
    ],
    Edit: [
      { label: "Undo", on: actions.undo, disabled: !canUndo },
      { label: "Redo", on: actions.redo, disabled: !canRedo },
    ],
    View: [
      { label: "Density plot", on: () => actions.setTab("density") },
      { label: "Embedding", on: () => actions.setTab("embedding") },
      { label: "Heatmap", on: () => actions.setTab("heatmap") },
      { label: "Statistics", on: () => actions.setTab("stats") },
    ],
    Analysis: [
      { label: "Compensate", on: () => void actions.compensate() },
      { label: "Add polygon gate", on: () => void actions.addPolygon() },
      { label: "Cluster — k-means", on: () => void actions.cluster("kmeans") },
      { label: "Cluster — FlowSOM", on: () => void actions.cluster("flowsom") },
      { label: "Cluster — PhenoGraph", on: () => void actions.cluster("phenograph") },
      { label: "Embed — PCA", on: () => void actions.embed("pca") },
      { label: "Embed — UMAP", on: () => void actions.embed("umap") },
      { label: "Embed — t-SNE", on: () => void actions.embed("tsne") },
      { label: "Compute statistics", on: () => void actions.computeStats() },
    ],
    Transform: [
      { label: "Logicle", on: () => actions.setTransform("logicle") },
      { label: "Arcsinh", on: () => actions.setTransform("asinh") },
      { label: "Linear", on: () => actions.setTransform("linear") },
    ],
    Help: [{ label: "About joeee", on: () => actions.home }],
  };

  const run = (it: Item) => {
    if (it.disabled) return;
    setOpen(null);
    it.on();
  };

  return (
    <div style={bar} onMouseLeave={() => setOpen(null)}>
      <strong style={{ padding: "0 12px", fontSize: 13 }}>joeee</strong>
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} style={{ position: "relative" }}>
          <button type="button" style={menuBtn(open === name)} onClick={() => setOpen(open === name ? null : name)}>
            {name}
          </button>
          {open === name && (
            <div style={dropdown}>
              {items.map((it) => (
                <button key={it.label} type="button" disabled={it.disabled} style={itemBtn(!!it.disabled)} onClick={() => run(it)}>
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const bar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 34,
  background: "#fff",
  borderBottom: "1px solid #d8d8dc",
  fontSize: 13,
};
const menuBtn = (active: boolean): CSSProperties => ({
  font: "inherit",
  fontSize: 13,
  padding: "6px 10px",
  border: "none",
  background: active ? "#eef4ff" : "transparent",
  cursor: "pointer",
});
const dropdown: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  zIndex: 10,
  minWidth: 200,
  background: "#fff",
  border: "1px solid #d8d8dc",
  borderRadius: 6,
  boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
  padding: 4,
  display: "flex",
  flexDirection: "column",
};
const itemBtn = (disabled: boolean): CSSProperties => ({
  font: "inherit",
  fontSize: 12,
  textAlign: "left",
  padding: "6px 10px",
  border: "none",
  borderRadius: 4,
  background: "transparent",
  color: disabled ? "#b0b0b5" : "#1d1d1f",
  cursor: disabled ? "default" : "pointer",
});
