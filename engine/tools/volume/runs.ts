// biome-ignore-all lint/suspicious/noExplicitAny: the local schema validates the stored run shape.
import { z } from "zod";
import { type Random, weighted } from "./random";

const storedRunSchema = z.object({
  id: z.string(),
  what: z.string(),
  instanceId: z.string().nullable(),
  coreName: z.string().nullable(),
  trigger: z.any(),
  startedBy: z.string().nullable(),
  startedAt: z.string(),
  ending: z.object({ state: z.string(), finishedAt: z.string(), doneCount: z.number() }).nullable(),
  itemCount: z.number(),
  itemsPerMinute: z.number().nullable(),
  errors: z.array(z.any()),
  failure: z.string().nullable(),
  note: z.string().nullable(),
  cancelledBy: z.string().nullable(),
  rerunOf: z.string().nullable(),
  changes: z.array(z.any()),
});
const typeRows = [
  ["ReindexDocuments", 4056, 54],
  ["ReindexCatalogRecords", 285, 0],
  ["SyncDocumentsWithCatalogs", 271, 1],
  ["SyncDocumentsWithDigitizationRegistry", 130, 2],
  ["PredictPeriodicalsPageCount", 58, 6],
  ["SyncCatalogRecordsWithCatalogs", 42, 3],
  ["RecreateIndexes", 16, 4],
  ["ReevaluateCatalogRecordsDifferences", 3, 0],
] as const;
const names: Record<string, string> = {
  ReindexDocuments: "Reindex documents",
  ReindexCatalogRecords: "Reindex catalog records",
  SyncDocumentsWithCatalogs: "MZK Aleph — catalog resync",
  SyncDocumentsWithDigitizationRegistry: "Kramerius — registry refresh",
  PredictPeriodicalsPageCount: "Periodicals model — page count prediction",
  SyncCatalogRecordsWithCatalogs: "MZK Aleph — catalog resync",
  RecreateIndexes: "Recreate indexes",
  ReevaluateCatalogRecordsDifferences: "Catalog validity — nightly sweep",
};
const itemErrors = [
  ["Schema mismatch while indexing document", 282],
  ["Missing volume year in catalog record", 235],
  ["Upstream 500 from knihovny.cz after retries", 12],
  ["Record not found in the catalog", 4],
  ["Unknown registry state", 15],
] as const;
const medianP90: Record<string, [number, number]> = {
  ReindexDocuments: [0.1, 0.1],
  ReindexCatalogRecords: [0.05, 0.09],
  SyncDocumentsWithCatalogs: [1.3, 2.4],
  SyncDocumentsWithDigitizationRegistry: [0.2, 2],
  PredictPeriodicalsPageCount: [7.5, 26],
  SyncCatalogRecordsWithCatalogs: [4, 85],
  RecreateIndexes: [264, 324],
  ReevaluateCatalogRecordsDifferences: [240, 1740],
};
const randInt = (random: Random, min: number, max: number) =>
  Math.floor(random() * (max - min + 1)) + min;

function weightedHour(random: Random): number {
  return weighted(random, [
    [8, 8],
    [9, 20],
    [10, 20],
    [11, 10],
    [12, 7],
    [13, 7],
    [14, 14],
    [15, 9],
    [16, 5],
  ] as const);
}
function sampledWorkday(random: Random, year: number, month: number): Date {
  for (;;) {
    const date = new Date(
      Date.UTC(
        year,
        month,
        randInt(random, 1, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
        weightedHour(random),
        randInt(random, 0, 59),
      ),
    );
    if (date.getUTCDay() > 0 && date.getUTCDay() < 6) return date;
  }
}

export function addRuns(
  random: Random,
  now: string,
  scale: number,
  base: any,
  iterations: any[],
  staff: string[],
) {
  const nowMs = Date.parse(now);
  const scheduleById = new Map(
    (base.collections.schedules ?? []).map((schedule: any) => [schedule.id, schedule]),
  );
  const scheduleByInstance = new Map(
    (base.collections.schedules ?? []).map((schedule: any) => [schedule.instanceId, schedule]),
  );
  const rows: any[] = [];
  let id = 1;
  const clusterMonths = new Set(["2025-11", "2026-02"]);
  const start = new Date(nowMs);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const months: Date[] = [];
  for (let offset = 12; offset >= 0; offset--)
    months.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - offset, 1)));
  const append = (type: string, started: Date, failed: boolean, forcedSchedule?: any) => {
    const isFailed = failed;
    const typeSchedule =
      type === "SyncDocumentsWithDigitizationRegistry"
        ? scheduleById.get("s2")
        : type === "ReevaluateCatalogRecordsDifferences"
          ? scheduleById.get("s4")
          : type.includes("Catalog") || type === "SyncDocumentsWithCatalogs"
            ? scheduleById.get("s1")
            : scheduleByInstance.get(type === "PredictPeriodicalsPageCount" ? "pi6" : "");
    const core =
      type === "ReindexDocuments" || type === "ReindexCatalogRecords" || type === "RecreateIndexes";
    const instanceId = core
      ? null
      : type === "SyncDocumentsWithDigitizationRegistry"
        ? "pi4"
        : type === "PredictPeriodicalsPageCount"
          ? "pi6"
          : type === "ReevaluateCatalogRecordsDifferences"
            ? "pi9"
            : "pi1";
    const schedule = forcedSchedule ?? typeSchedule;
    const manual = !forcedSchedule && !core && random() < 0.04;
    const trigger =
      forcedSchedule || (schedule && !manual)
        ? { kind: "schedule", scheduleId: schedule.id, cadence: schedule.cadence }
        : { kind: "manual", from: { label: "Tasks", path: "/tasks" } };
    const startedBy =
      trigger.kind === "schedule"
        ? null
        : (staff[randInt(random, 0, Math.max(0, staff.length - 1))] ?? "vu1");
    let duration: number;
    if (isFailed)
      duration =
        type === "ReindexDocuments"
          ? 480
          : type === "SyncDocumentsWithDigitizationRegistry"
            ? randInt(random, 90, 156) * 60
            : type === "SyncCatalogRecordsWithCatalogs"
              ? randInt(random, 20, 120) * 60
              : randInt(random, medianP90[type]![1] * 2, medianP90[type]![1] * 10);
    else
      duration =
        medianP90[type]![0] < 1 ? medianP90[type]![0] : logDuration(random, ...medianP90[type]!);
    const itemCount = Math.max(
      1,
      Math.round(
        (type === "ReindexDocuments" ? 17134 : type.includes("Catalog") ? 14183 : 1204) * scale,
      ),
    );
    const errorCount = isFailed
      ? randInt(random, 2, Math.min(5, itemCount))
      : random() < 0.07
        ? 1
        : 0;
    const errors = Array.from({ length: errorCount }, (_, index) => ({
      iterationId: iterations[randInt(random, 0, iterations.length - 1)]?.id ?? "V-IT1",
      message: weighted(random, itemErrors),
      atItem: randInt(random, 1, itemCount),
    }));
    const doneCount = isFailed ? Math.min(itemCount, Math.floor(itemCount * 0.6)) : itemCount;
    const finishedAt = new Date(started.getTime() + duration * 1000).toISOString();
    const state = isFailed ? "Failed" : random() < 0.004 ? "Cancelled" : "Done";
    const row = {
      id: `V-T${id++}`,
      what: names[type] ?? type,
      instanceId,
      coreName: core ? type : null,
      trigger,
      startedBy,
      startedAt: started.toISOString(),
      ending: { state, finishedAt, doneCount },
      itemCount,
      itemsPerMinute: duration > 0 ? Math.round((doneCount / duration) * 60 * 10) / 10 : null,
      errors,
      failure: isFailed
        ? type === "ReindexDocuments"
          ? "Timed out after eight minutes."
          : "HTTP 500 after retries."
        : null,
      note: null,
      cancelledBy: state === "Cancelled" ? startedBy : null,
      rerunOf: null,
      changes: [],
    };
    rows.push(storedRunSchema.parse(row));
  };
  for (const month of months) {
    const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    const target = Math.round(randInt(random, 100, 400) * scale);
    for (let i = 0; i < target; i++) {
      const type = weighted(
        random,
        typeRows.map(([name, total]) => [name, total] as const),
      );
      const failedDate = sampledWorkday(random, month.getUTCFullYear(), month.getUTCMonth());
      const age = nowMs - failedDate.getTime();
      const rate = typeRows.find(([name]) => name === type)!;
      const isFailure = random() < (rate[2] / rate[1]) * (clusterMonths.has(key) ? 5 : 1);
      if (age > 365 * 86400000) continue;
      if (age > 90 * 86400000 && !isFailure) continue;
      if (failedDate.getTime() > nowMs) continue;
      append(type, failedDate, isFailure);
    }
  }
  const saturday = new Date(nowMs - 90 * 86400000);
  while (saturday.getUTCDay() !== 6) saturday.setUTCDate(saturday.getUTCDate() + 1);
  for (
    let date = saturday;
    date.getTime() < nowMs;
    date = new Date(date.getTime() + 7 * 86400000)
  ) {
    const scheduled = new Date(date);
    scheduled.setUTCHours(1, 0, 0, 0);
    append("SyncDocumentsWithDigitizationRegistry", scheduled, false, scheduleById.get("s2"));
  }
  return rows;
}

function logDuration(random: Random, median: number, p90: number): number {
  const sigma = Math.log(p90 / median) / 1.2815515655446004;
  const u1 = Math.max(random(), Number.EPSILON);
  const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * random());
  return Math.max(0.01, median * Math.exp(normal * sigma));
}
