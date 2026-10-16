// The engine's SQLite database: opened with foreign keys on, brought up to date by the numbered
// SQL files in migrations/, and emptied on a reset.

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const migrationsDir = join(import.meta.dir, "..", "migrations");

export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

interface Migration {
  version: number;
  name: string;
  sql: string;
}

// Files named NNNN_name.sql, in the order of their number.
export function readMigrations(dir: string = migrationsDir): Migration[] {
  return readdirSync(dir)
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort()
    .map((file) => ({
      version: Number(file.slice(0, 4)),
      name: file.slice(5, -4),
      sql: readFileSync(join(dir, file), "utf8"),
    }));
}

// Applies every migration not applied yet, each in its own transaction. Returns their versions.
export function migrate(db: Database, migrations: Migration[] = readMigrations()): number[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL)",
  );
  const applied = new Set(
    db
      .query<{ version: number }, []>("SELECT version FROM schema_migrations")
      .all()
      .map(({ version }) => version),
  );
  const done: number[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    db.transaction(() => {
      db.exec(migration.sql);
      db.query("INSERT INTO schema_migrations (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.name,
      );
    })();
    done.push(migration.version);
  }

  return done;
}

// Drops every table. Foreign keys are switched off meanwhile, which SQLite allows only outside a
// transaction.
export function dropEverything(db: Database): void {
  db.exec("PRAGMA foreign_keys = OFF;");
  const tables = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  for (const { name } of tables) {
    db.exec(`DROP TABLE IF EXISTS "${name}"`);
  }
  db.exec("PRAGMA foreign_keys = ON;");
}
