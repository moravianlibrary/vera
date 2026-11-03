import { createEngine } from "@vera/engine/src/engine";

export function startLocalEngine() {
  const engine = createEngine({
    databasePath: ":memory:",
    development: true,
    seed: "base",
    frozenClock: true,
  });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: engine.fetch });
  return {
    url: server.url.toString().replace(/\/$/, ""),
    stop() {
      server.stop(true);
      engine.close();
    },
  };
}
