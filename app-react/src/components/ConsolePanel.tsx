import type { CSSProperties } from "react";

/** Bottom console — an operation log (newest first). */
export function ConsolePanel({ log }: { log: string[] }) {
  return (
    <div style={wrap}>
      <div style={title}>Console</div>
      <div style={body}>
        {log.length === 0 ? (
          <div style={{ color: "#86868b" }}>operations will log here…</div>
        ) : (
          log.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  borderTop: "1px solid #d8d8dc",
  background: "#1d1d1f",
  color: "#e5e5e8",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};
const title: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#86868b",
  padding: "4px 10px",
  borderBottom: "1px solid #333",
};
const body: CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "6px 10px",
  fontFamily: "SF Mono, Menlo, monospace",
  fontSize: 11,
  lineHeight: 1.6,
};
