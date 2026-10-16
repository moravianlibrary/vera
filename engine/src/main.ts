// Runs the engine on a port: `make engine`. The database file survives restarts; a new one is
// loaded from the base seed, and one built from other schema files is rebuilt from its seed.
//   VERA_ENGINE_PORT         default 8080, where the frontend's live mode proxies /api
//   VERA_ENGINE_DATABASE     default engine/.data/vera.sqlite
//   VERA_ENGINE_DEVELOPMENT  "1" honours the dev servers' header and serves /_engine

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createEngine } from "./engine";

const port = Number(process.env.VERA_ENGINE_PORT ?? 8080);
const databasePath =
  process.env.VERA_ENGINE_DATABASE ?? join(import.meta.dir, "..", ".data", "vera.sqlite");
const development = process.env.VERA_ENGINE_DEVELOPMENT === "1";

mkdirSync(dirname(databasePath), { recursive: true });
const engine = createEngine({ databasePath, development });
const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: engine.fetch });

console.log(
  `VERA engine on ${server.url} (${development ? "development" : "no dev header, no /_engine"}), database ${databasePath}, clock ${engine.clock.now().toISOString()}`,
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.stop();
    engine.close();
    process.exit(0);
  });
}
