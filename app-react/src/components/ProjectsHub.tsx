import type { CSSProperties } from "react";

/** Page 1 — a minimal projects landing that opens into the analysis workspace. */
export function ProjectsHub({
  onOpen,
  onFile,
}: {
  onOpen: () => void;
  onFile: (file: File) => void;
}) {
  return (
    <div style={wrap}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 28, margin: 0, letterSpacing: "-0.5px" }}>joeee</h1>
        <p style={{ color: "#6e6e73", marginTop: 8 }}>
          browser-native, headless-first flow cytometry
        </p>
      </div>
      <div style={grid}>
        <button type="button" style={card} onClick={onOpen}>
          <div style={cardTitle}>＋ New analysis</div>
          <div style={cardSub}>Open the demo project (synthetic two-cluster sample) and start gating.</div>
        </button>
        <label
          style={card}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer?.files?.[0];
            if (f) onFile(f);
          }}
        >
          <div style={cardTitle}>Open FCS…</div>
          <div style={cardSub}>Click to choose, or drag an .fcs file here.</div>
          <input
            type="file"
            accept=".fcs"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        <div style={{ ...card, cursor: "default" }}>
          <div style={cardTitle}>Recent</div>
          <div style={cardSub}>No recent projects yet.</div>
        </div>
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 32,
  alignItems: "center",
  justifyContent: "center",
  background: "#f5f5f7",
  fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
};
const grid: CSSProperties = { display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 760 };
const card: CSSProperties = {
  width: 220,
  textAlign: "left",
  background: "#fff",
  border: "1px solid #d8d8dc",
  borderRadius: 10,
  padding: 16,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  font: "inherit",
};
const cardTitle: CSSProperties = { fontSize: 15, fontWeight: 600, marginBottom: 6, color: "#0a84ff" };
const cardSub: CSSProperties = { fontSize: 12, color: "#6e6e73", lineHeight: 1.4 };
