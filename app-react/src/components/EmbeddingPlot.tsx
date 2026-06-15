import { useEffect, useRef, type CSSProperties } from "react";
import type { ClusterResult, EmbedResult } from "@joeee/engine-controller";

const W = 560;
const H = 520;
const PALETTE = [
  "#0a84ff", "#34c759", "#ff9500", "#ff3b30", "#5856d6", "#af52de",
  "#ff2d55", "#5ac8fa", "#ffcc00", "#30d158", "#bf5af2", "#64d2ff",
];

/** Mock embedding scatter: plots the 2-D embedding, colored by the last
 *  clustering (via eventIndex→label) when available. */
export function EmbeddingPlot({
  embedding,
  clusters,
}: {
  embedding: EmbedResult | null;
  clusters: ClusterResult | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    if (!embedding || embedding.points.length === 0) {
      ctx.fillStyle = "#86868b";
      ctx.font = "13px system-ui";
      ctx.fillText("Run a dim-reduction (PCA / UMAP / t-SNE) to see an embedding.", 20, 30);
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of embedding.points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const sx = (W - 40) / ((maxX - minX) || 1);
    const sy = (H - 40) / ((maxY - minY) || 1);
    const labelOf = new Map<number, number>();
    if (clusters) clusters.eventIndex.forEach((e, i) => labelOf.set(e, clusters.labels[i]));
    for (let i = 0; i < embedding.points.length; i++) {
      const [x, y] = embedding.points[i];
      const px = 20 + (x - minX) * sx;
      const py = H - 20 - (y - minY) * sy;
      const lbl = labelOf.get(embedding.eventIndex[i]);
      ctx.fillStyle = lbl === undefined ? "rgba(10,132,255,0.45)" : PALETTE[lbl % PALETTE.length];
      ctx.fillRect(px, py, 2.5, 2.5);
    }
  }, [embedding, clusters]);

  return (
    <div>
      <canvas ref={ref} width={W} height={H} style={canvas} />
      <div style={legend}>
        {clusters ? `${clusters.clusterCount} clusters` : "no clustering — points uncolored"}
      </div>
    </div>
  );
}

const canvas: CSSProperties = { background: "#fff", border: "1px solid #d8d8dc", borderRadius: 4 };
const legend: CSSProperties = { fontSize: 11, color: "#6e6e73", marginTop: 6 };
