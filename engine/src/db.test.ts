import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dropEverything, migrate, openDatabase, readMigrations } from "./db";

function tablesOf(db: ReturnType<typeof openDatabase>): string[] {
  return db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map(({ name }) => name);
}

describe("the database", () => {
  it("applies the migrations in order, once", () => {
    const db = openDatabase(":memory:");
    const versions = readMigrations().map(({ version }) => version);
    expect(migrate(db)).toEqual(versions);
    expect(migrate(db)).toEqual([]);
    expect(tablesOf(db)).toContain("engine_state");
  });

  it("applies only the migrations added since", () => {
    const dir = mkdtempSync(join(tmpdir(), "vera-migrations-"));
    writeFileSync(join(dir, "0001_one.sql"), "CREATE TABLE one (id INTEGER);");
    const db = openDatabase(":memory:");
    expect(migrate(db, readMigrations(dir))).toEqual([1]);
    writeFileSync(join(dir, "0002_two.sql"), "CREATE TABLE two (id INTEGER);");
    expect(migrate(db, readMigrations(dir))).toEqual([2]);
  });

  it("rolls a failing migration back whole", () => {
    const dir = mkdtempSync(join(tmpdir(), "vera-migrations-"));
    writeFileSync(join(dir, "0001_bad.sql"), "CREATE TABLE half (id INTEGER); NOT SQL;");
    const db = openDatabase(":memory:");
    expect(() => migrate(db, readMigrations(dir))).toThrow();
    expect(tablesOf(db)).toEqual(["schema_migrations"]);
  });

  it("drops every table on a reset", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    dropEverything(db);
    expect(tablesOf(db)).toEqual([]);
  });
});
