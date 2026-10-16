import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySchema, dropEverything, openDatabase, readSchema } from "./db";

function tablesOf(db: ReturnType<typeof openDatabase>): string[] {
  return db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map(({ name }) => name);
}

function schemaDirWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "vera-schema-"));
  for (const [name, sql] of Object.entries(files)) {
    writeFileSync(join(dir, name), sql);
  }
  return dir;
}

describe("the database", () => {
  it("is built from every schema file", () => {
    const db = openDatabase(":memory:");
    applySchema(db, readSchema());
    expect(tablesOf(db)).toContain("engine_state");
    expect(tablesOf(db)).toContain("users");
  });

  it("knows its schema changed by the hash", () => {
    const dir = schemaDirWith({ "a.sql": "CREATE TABLE one (id INTEGER);" });
    const before = readSchema(dir).hash;
    expect(readSchema(dir).hash).toBe(before);
    writeFileSync(join(dir, "a.sql"), "CREATE TABLE one (id TEXT);");
    expect(readSchema(dir).hash).not.toBe(before);
  });

  it("leaves nothing of a schema that fails", () => {
    const dir = schemaDirWith({ "a.sql": "CREATE TABLE half (id INTEGER);", "b.sql": "NOT SQL;" });
    const db = openDatabase(":memory:");
    expect(() => applySchema(db, readSchema(dir))).toThrow();
    expect(tablesOf(db)).toEqual([]);
  });

  it("drops every table on a reset", () => {
    const db = openDatabase(":memory:");
    applySchema(db, readSchema());
    dropEverything(db);
    expect(tablesOf(db)).toEqual([]);
  });
});
