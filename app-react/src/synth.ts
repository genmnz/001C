/** Two synthetic clusters so the shell has structure without a real FCS file. */
export function synthClusters(n = 80_000): {
  channels: { name: string }[];
  columns: Float32Array[];
} {
  const fsc = new Float32Array(n);
  const cd3 = new Float32Array(n);
  const g = () =>
    (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
  for (let i = 0; i < n; i++) {
    const lower = i < n * 0.6;
    const cx = lower ? 800 : 40_000;
    const cy = lower ? 1_200 : 35_000;
    fsc[i] = Math.max(1, cx + g() * cx * 0.5);
    cd3[i] = Math.max(1, cy + g() * cy * 0.5);
  }
  return { channels: [{ name: "FSC-A" }, { name: "CD3" }], columns: [fsc, cd3] };
}
