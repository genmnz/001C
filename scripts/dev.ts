/**
 * `bun run both` / `bun run dev` — run the web app (Vite) and the test watcher
 * side by side. Ctrl-C stops both. See package.json scripts:
 *   bun i          install everything
 *   bun run web    just the web app
 *   bun test       just the tests
 *   bun run both   web + tests together
 */
const procs = [
  Bun.spawn(["bun", "run", "dev"], {
    cwd: "app-react",
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
  Bun.spawn(["bun", "test", "--watch"], {
    stdout: "inherit",
    stderr: "inherit",
  }),
];

const shutdown = () => {
  for (const p of procs) {
    try {
      p.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.race(procs.map((p) => p.exited));
shutdown();

export {};
