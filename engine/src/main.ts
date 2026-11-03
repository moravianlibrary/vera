// Runs the engine on a port: `make engine`. The database file survives restarts; a new one is
// loaded from the base seed, and one built from other schema files is rebuilt from its seed.
//   VERA_ENGINE_PORT         default 8080, where the frontend's live mode proxies /api
//   VERA_ENGINE_DATABASE     default engine/.data/vera.sqlite
//   VERA_ENGINE_DEVELOPMENT  "1" honours the dev servers' header and serves /_engine
//   VERA_ENGINE_OTEL_ENDPOINT  an OTLP/HTTP base URL (make obs-up: http://localhost:4318); unset or
//                              empty: no telemetry, the SDK is not loaded (OBS-pipeline)
//   VERA_ENGINE_OTEL_KEY       the collector's ingestion key from HyperDX, sent as `authorization`

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createEngine } from "./engine";
import { sendAudit } from "./telemetry/audit";
import { startTelemetry, stopTelemetry } from "./telemetry/telemetry";

const port = Number(process.env.VERA_ENGINE_PORT ?? 8080);
const databasePath =
  process.env.VERA_ENGINE_DATABASE ?? join(import.meta.dir, "..", ".data", "vera.sqlite");
const development = process.env.VERA_ENGINE_DEVELOPMENT === "1";
const telemetryEndpoint = process.env.VERA_ENGINE_OTEL_ENDPOINT;
await startTelemetry({ endpoint: telemetryEndpoint, key: process.env.VERA_ENGINE_OTEL_KEY });

mkdirSync(dirname(databasePath), { recursive: true });
const engine = createEngine({ databasePath, development });
const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: engine.fetch });

console.log(
  `VERA engine on ${server.url} (${development ? "development" : "no dev header, no /_engine"}), database ${databasePath}, clock ${engine.clock.now().toISOString()}, ${telemetryEndpoint ? `telemetry to ${telemetryEndpoint}` : "audit kept locally"}`,
);

let sending: Promise<void> | null = null;
const auditSettings = { endpoint: telemetryEndpoint, key: process.env.VERA_ENGINE_OTEL_KEY };
const sendPendingAudit = async () => {
  if (!telemetryEndpoint) return;
  if (sending !== null) return sending;
  sending = sendAudit(engine, auditSettings)
    .then(() => undefined)
    .finally(() => {
      sending = null;
    });
  return sending;
};
if (telemetryEndpoint)
  setInterval(() => {
    void sendPendingAudit();
  }, 5_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    server.stop();
    await sendPendingAudit();
    await stopTelemetry();
    engine.close();
    process.exit(0);
  });
}
