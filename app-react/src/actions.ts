/** Workspace view tabs and the set of operations the menus + sidebar invoke. */
export type Tab = "density" | "embedding" | "heatmap" | "stats";

export interface Actions {
  openDemo(): Promise<void> | void;
  home(): void;
  compensate(): Promise<void>;
  addPolygon(): Promise<void>;
  cluster(method: "kmeans" | "flowsom" | "phenograph"): Promise<void>;
  embed(method: "pca" | "umap" | "tsne"): Promise<void>;
  computeStats(): Promise<void>;
  exportWorkspace(): void;
  exportCsv(): void;
  importGatingML(): Promise<void>;
  setTransform(kind: "logicle" | "asinh" | "linear"): void;
  undo(): void;
  redo(): void;
  setTab(tab: Tab): void;
}
