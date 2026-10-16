// The engine: one SQLite database, its clock, jobs and outbox, VERA's API under /api and, in
// development only, the control endpoints under /_engine.

import type { Database } from "bun:sqlite";
import { callerOf } from "./access/caller";
import { sessionEndpoints } from "./access/endpoints";
import type { Clock } from "./clock";
import { createClock } from "./clock";
import { controlPrefix, serveControl } from "./control";
import { dropEverything, migrate, openDatabase } from "./db";
import { apiPrefix, serveApi } from "./http/api";
import type { Endpoint } from "./http/endpoint";
import { problem } from "./http/problem";
import type { Jobs } from "./jobs";
import { createJobs } from "./jobs";
import type { Outbox } from "./outbox";
import { createOutbox } from "./outbox";
import { loadSeed, readSeed, seedsDir } from "./seed";

export interface EngineOptions {
  // ":memory:" for a test.
  databasePath: string;
  // Honours the dev servers' header and serves /_engine.
  development: boolean;
  // The seed loaded when the database is new.
  seed?: string;
  seedsDir?: string;
  // Tests freeze the clock; development lets it run.
  frozenClock?: boolean;
  wallNow?: () => number;
}

export interface Engine {
  db: Database;
  clock: Clock;
  jobs: Jobs;
  outbox: Outbox;
  development: boolean;
  fetch(request: Request): Promise<Response>;
  // Drops everything and loads the named seed; the clock goes to the seed's moment.
  reset(seed: string): void;
  close(): void;
}

export const endpoints: readonly Endpoint[] = [...sessionEndpoints];

const seedKey = "seed";

export function createEngine(options: EngineOptions): Engine {
  const db = openDatabase(options.databasePath);
  migrate(db);
  const clock = createClock(db, options.wallNow);
  const jobs = createJobs(db, clock);
  const outbox = createOutbox(db, clock);
  const frozen = options.frozenClock ?? false;

  const engine: Engine = {
    db,
    clock,
    jobs,
    outbox,
    development: options.development,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`)) {
        return serveApi(request, endpoints, engine, (incoming) =>
          callerOf(db, incoming, options.development),
        );
      }

      if (options.development && pathname.startsWith(`${controlPrefix}/`)) {
        return serveControl(request, engine);
      }

      return problem(404, `Nothing is served at ${pathname}.`);
    },
    reset(name) {
      // Read first: an unknown seed leaves the database as it was.
      const seed = readSeed(name, options.seedsDir ?? seedsDir);
      dropEverything(db);
      migrate(db);
      db.transaction(() => {
        loadSeed(db, seed);
        db.query("INSERT INTO engine_state (key, value) VALUES (?, ?)").run(seedKey, seed.name);
        clock.reset(new Date(seed.now), frozen);
      })();
    },
    close() {
      db.close();
    },
  };

  const loaded = db
    .query<{ value: string }, [string]>("SELECT value FROM engine_state WHERE key = ?")
    .get(seedKey);
  if (loaded === null) {
    engine.reset(options.seed ?? "base");
  }

  return engine;
}
