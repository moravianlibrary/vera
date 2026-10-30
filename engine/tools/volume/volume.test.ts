import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  batchSchema,
  categorySchema,
  documentSchema,
  iterationSchema,
  requestSchema,
  userSchema,
} from "@vera/domain/entities";
import { createEngine } from "../../src/engine";
import { generateVolumeSeed } from "../seed-volume";
import { logNormal, mulberry32 } from "./random";
import { sampleArrival } from "./time";

const seedDir = join(import.meta.dir, "../../seeds");
const base = await Bun.file(join(seedDir, "base.json")).json();
const installation = await Bun.file(join(seedDir, "installation.json")).json();
const temporary: string[] = [];
afterEach(async () =>
  Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))),
);

describe("volume seed generator", () => {
  test("is deterministic and validates all generated records", () => {
    const first = generateVolumeSeed(base, 21, 0.02);
    const repeated = generateVolumeSeed(base, 21, 0.02);
    expect(JSON.stringify(first)).toBe(JSON.stringify(repeated));
    expect(JSON.stringify(generateVolumeSeed(base, 22, 0.02))).not.toBe(JSON.stringify(first));
    for (const row of first.collections.users) userSchema.parse(row);
    for (const row of first.collections.categories) categorySchema.parse(row);
    for (const row of first.collections.documents) documentSchema.parse(row);
    for (const row of first.collections.iterations) iterationSchema.parse(row);
    for (const row of first.collections.requests) requestSchema.parse(row);
    for (const row of first.collections.batches) batchSchema.parse(row);
  });

  test("produces scaled volumes and synthetic identities", () => {
    const result = generateVolumeSeed(base, 1, 0.02);
    expect(result.collections.documents.length).toBeGreaterThan(308);
    expect(result.collections.documents.length).toBeLessThan(377);
    expect(result.fakes.catalogRecords.length - base.fakes.catalogRecords.length).toBeLessThan(312);
    expect(result.fakes.catalogRecords.length - base.fakes.catalogRecords.length).toBeGreaterThan(
      255,
    );
    expect(
      result.collections.users.filter(
        (user) =>
          user.id.startsWith("vu") &&
          result.collections.userAccess[user.id]?.mappedRoles[0]?.roleId === "reader",
      ).length,
    ).toBe(9);
    expect(
      result.collections.users.filter(
        (user) => user.id.startsWith("vu") && userAccessIsStaff(result, user.id),
      ),
    ).toHaveLength(10);
    expect(
      result.collections.users.every((user) => !user.email || user.email.endsWith("@example.org")),
    ).toBe(true);
    expectGeneratedIdsDoNotCollide(result);
  });

  test("sampled arrivals follow Prague work hours and weekdays", () => {
    const random = mulberry32(721);
    const months = [1, 6, 9, 17, 23, 29];
    const arrivals = Array.from({ length: 5000 }, (_, index) =>
      sampleArrival(random, months[index % months.length]!),
    );
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Prague",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    });
    const hours = new Map<number, number>();
    const weekdays = new Map<string, number>();
    const allowedHours = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18]);
    for (const arrival of arrivals) {
      const parts = formatter.formatToParts(arrival);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      const weekday = parts.find((part) => part.type === "weekday")?.value;
      expect(allowedHours.has(hour)).toBe(true);
      hours.set(hour, (hours.get(hour) ?? 0) + 1);
      weekdays.set(weekday!, (weekdays.get(weekday!) ?? 0) + 1);
    }
    const busiestHourCount = Math.max(...hours.values());
    expect(hours.get(9) === busiestHourCount || hours.get(10) === busiestHourCount).toBe(true);
    expect(weekdays.get("Tue")).toBe(Math.max(...weekdays.values()));
  });

  test("generated requests stay before now and the latest month is not overrepresented", () => {
    const result = generateVolumeSeed(base, 1, 0.1);
    expect(
      result.collections.requests.every(
        (request) => Date.parse(request.at) < Date.parse(result.now),
      ),
    ).toBe(true);
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Prague",
      year: "numeric",
      month: "2-digit",
      weekday: "short",
    });
    const part = (date: Date, type: Intl.DateTimeFormatPartTypes) =>
      formatter.formatToParts(date).find((item) => item.type === type)?.value;
    const months = new Map<string, number>();
    for (const request of result.collections.requests) {
      const date = new Date(request.at);
      const month = `${part(date, "year")}-${part(date, "month")}`;
      months.set(month, (months.get(month) ?? 0) + 1);
    }
    const latestMonth = [...months.keys()].sort().at(-1)!;
    const monthlyCounts = [...months.values()].sort((left, right) => left - right);
    const medianMonth = monthlyCounts[Math.floor(monthlyCounts.length / 2)]!;
    expect(months.get(latestMonth)).toBeLessThanOrEqual(2 * medianMonth);
  });

  test("page counts follow the configured median", () => {
    const random = mulberry32(4);
    const values = Array.from({ length: 2000 }, () => logNormal(random, 154, 374)).sort(
      (a, b) => a - b,
    );
    expect(values[999]).toBeGreaterThan(154 * 0.85);
    expect(values[999]).toBeLessThan(154 * 1.15);
  });

  test("the engine loads the extension and opens a staff session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "vera-volume-"));
    temporary.push(directory);
    await writeFile(join(directory, "base.json"), JSON.stringify(base));
    await writeFile(
      join(directory, "installation.json"),
      await readFile(join(seedDir, "installation.json"), "utf8"),
    );
    await writeFile(
      join(directory, "volume.json"),
      JSON.stringify(generateVolumeSeed(base, 2, 0.02)),
    );
    const engine = createEngine({
      databasePath: ":memory:",
      development: true,
      seed: "volume",
      seedsDir: directory,
      frozenClock: true,
    });
    try {
      const session = await engine.fetch(
        new Request("http://engine.test/_engine/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "vu1" }),
        }),
      );
      expect(session.status).toBe(200);
      const response = await engine.fetch(
        new Request("http://engine.test/api/session", {
          headers: { Cookie: session.headers.get("Set-Cookie")!.split(";")[0]! },
        }),
      );
      expect(response.status).toBe(200);
    } finally {
      engine.close();
    }
  });
});

function expectGeneratedIdsDoNotCollide(result: ReturnType<typeof generateVolumeSeed>) {
  const parentCollections = [base.collections, installation.collections];
  const idOf = (row: unknown): string | undefined =>
    typeof row === "object" && row !== null && "id" in row && typeof row.id === "string"
      ? row.id
      : undefined;
  for (const [name, value] of Object.entries(result.collections)) {
    const generatedIds = Array.isArray(value)
      ? value.map(idOf).filter((id): id is string => id !== undefined)
      : typeof value === "object" && value !== null
        ? Object.keys(value)
        : [];
    const parentIds = new Set(
      parentCollections.flatMap((collections) => {
        const rows = collections[name];
        return Array.isArray(rows)
          ? rows.map(idOf).filter((id): id is string => id !== undefined)
          : typeof rows === "object" && rows !== null
            ? Object.keys(rows)
            : [];
      }),
    );
    expect(generatedIds.some((id) => parentIds.has(id))).toBe(false);
  }

  const parentCatalogIds = new Set(
    [...(base.fakes.catalogRecords ?? []), ...(installation.fakes?.catalogRecords ?? [])].map(
      (record: { catalogId: string }) => record.catalogId,
    ),
  );
  const catalogIds = result.fakes.catalogRecords.map(
    (record: { catalogId: string }) => record.catalogId,
  );
  const generatedCatalogIds = catalogIds.filter((catalogId) => catalogId.startsWith("MZK01-9"));
  expect(generatedCatalogIds.every((catalogId) => !parentCatalogIds.has(catalogId))).toBe(true);
  expect(generatedCatalogIds.length).toBe(
    result.fakes.catalogRecords.length - base.fakes.catalogRecords.length,
  );
  expect(new Set(catalogIds).size).toBe(catalogIds.length);
}

function userAccessIsStaff(result: ReturnType<typeof generateVolumeSeed>, userId: string): boolean {
  return result.collections.userAccess[userId]?.handRoleIds.length > 0;
}
