import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extendSeed } from "@vera/contract/seed-extends";
import { operationsMatchKind } from "@vera/domain/plugins";
import { seedPatchSchema, seedSchema } from "../../contract/seed/seed";
import { readSeed, seedsDir } from "./seed";

test("every seed patch and its extended value match the seed schemas", () => {
  for (const file of readdirSync(seedsDir).filter((name) => name.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(join(seedsDir, file), "utf8"));
    expect(seedPatchSchema.parse(raw)).toBeDefined();
    expect(seedSchema.parse(readSeed(file.slice(0, -5)))).toBeDefined();
    if (raw.extends) {
      const parent = JSON.parse(readFileSync(join(seedsDir, `${raw.extends}.json`), "utf8"));
      expect(seedSchema.parse(extendSeed(parent, raw))).toBeDefined();
    }
  }
});

test("every seed version declares only operations optional for its kind", () => {
  for (const file of readdirSync(seedsDir).filter((name) => name.endsWith(".json"))) {
    const seed = seedSchema.parse(readSeed(file.slice(0, -5)));
    for (const implementation of seed.collections.pluginImplementations ?? []) {
      for (const version of implementation.versions) {
        expect(operationsMatchKind(implementation.kind, version.declares.operations ?? [])).toBe(
          true,
        );
      }
    }
  }
});

test("unknown collection keys and incomplete records name the rejected path", () => {
  const seed = readSeed("minimal");
  const unknown = seedSchema.safeParse({
    ...seed,
    collections: { ...seed.collections, mystery: [] },
  });
  expect(unknown.success).toBe(false);
  if (!unknown.success) expect(JSON.stringify(unknown.error.issues)).toContain("mystery");
  const missing = seedSchema.safeParse({
    ...seed,
    collections: { ...seed.collections, users: [{ id: "u1" }] },
  });
  expect(missing.success).toBe(false);
  if (!missing.success) expect(JSON.stringify(missing.error.issues)).toContain("name");
});
