// The engine's SQLite database: opened with foreign keys on, and built from the schema files in
// schema/. Nothing in it is kept: it is always rebuilt from a seed, so a schema change needs no
// migration. The engine keeps the schema's hash, and rebuilds when the files no longer match.

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const schemaDir = join(import.meta.dir, "..", "schema");

export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true, strict: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

export interface Schema {
  // Every file's statements, in the order of the files' names.
  sql: string;
  // Changes whenever a file is added, removed or edited.
  hash: string;
}

export function readSchema(dir: string = schemaDir): Schema {
  const hasher = new Bun.CryptoHasher("sha256");
  const parts = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const sql = readFileSync(join(dir, file), "utf8");
      hasher.update(`${file}\n${sql}\n`);
      return sql;
    });
  return { sql: parts.join("\n"), hash: hasher.digest("hex") };
}

// On an empty database, in one transaction: a schema that fails leaves nothing.
export function applySchema(db: Database, schema: Schema): void {
  db.transaction(() => db.exec(schema.sql))();
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
