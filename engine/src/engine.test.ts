// The database across restarts: kept while the schema files are the same, rebuilt from the seed
// it held when they change.

import { describe, expect, it } from "bun:test";
import { appendFileSync, cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSession } from "./access/sessions";
import { schemaDir } from "./db";
import { createEngine } from "./engine";

function setUp() {
  const dir = mkdtempSync(join(tmpdir(), "vera-engine-"));
  const schema = join(dir, "schema");
  cpSync(schemaDir, schema, { recursive: true });
  const open = () =>
    createEngine({
      databasePath: join(dir, "vera.sqlite"),
      development: true,
      seed: "minimal",
      schemaDir: schema,
      frozenClock: true,
    });
  return { schema, open };
}

const sessionsOf = (engine: ReturnType<typeof createEngine>) =>
  engine.db.query<{ n: number }, []>("SELECT count(*) AS n FROM sessions").get()?.n;

describe("the database across restarts", () => {
  it("is kept while the schema files are the same", () => {
    const { open } = setUp();
    const first = open();
    openSession(first, "u1", null);
    first.close();
    const second = open();
    expect(sessionsOf(second)).toBe(1);
    second.close();
  });

  it("is rebuilt from the seed it held when they change", () => {
    const { schema, open } = setUp();
    const first = open();
    openSession(first, "u1", null);
    first.clock.advance(60_000);
    first.close();
    appendFileSync(join(schema, "people.sql"), "\nCREATE TABLE added (id TEXT);\n");
    const second = open();
    expect(sessionsOf(second)).toBe(0);
    expect(second.clock.now().toISOString()).toBe("2026-06-25T08:40:00.000Z");
    second.close();
  });
});
