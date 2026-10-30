// Tasks end to end against the mock server over HTTP: who sees which runs, a run still going as
// far as its pace takes it at the mock's moment, the filters and their facets, upcoming runs, one
// run's items and log, and cancel, run again and retention. The mock's clock stands still under
// tests. The acts change the mock's state, so they come last, each on its own run.

import { parseRunSearchParams, toRunSearchParams } from "@vera/contract/tasks";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { listPluginInstances } from "@/api/reference";
import {
  cancelRun,
  getRun,
  getRunLog,
  listRunningRuns,
  listRuns,
  runAgain,
  saveRetention,
} from "@/api/tasks";
import type { MockUserProfile } from "@/config/env";
import { historicalRuns } from "@/mocks/fixtures/tasks";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function refusalOf(
  call: Promise<unknown>,
): Promise<{ status: number; code?: string } | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? { status: error.status, code: error.problem?.code } : null;
  }
}

const idsOf = (runs: readonly { id: string }[]) => runs.map((run) => run.id);

// The runs written by hand, without the generated history that fills Tasks for scrolling.
const historyIds = new Set(historicalRuns.map((run) => run.id));
const handIdsOf = (runs: readonly { id: string }[]) =>
  idsOf(runs).filter((id) => !historyIds.has(id));

describe("the query in the URL", () => {
  it("reads back what it wrote and drops what it does not know", () => {
    const query = { states: ["Failed" as const], triggers: ["schedule" as const], search: "aleph" };

    expect(parseRunSearchParams(toRunSearchParams(query))).toEqual({
      ...query,
      instanceIds: undefined,
      startedBy: undefined,
      started: undefined,
    });
    expect(parseRunSearchParams(new URLSearchParams("state=Running,Nope")).states).toEqual([
      "Running",
    ]);
    expect(
      parseRunSearchParams(toRunSearchParams({ started: { preset: "last-7-days" } })).started,
    ).toEqual({ preset: "last-7-days" });
  });
});

describe("listRuns", () => {
  it("is refused to a reader, who starts no runs", async () => {
    signInAs("reader");

    expect(await refusalOf(listRuns({}))).toMatchObject({ status: 403 });
  });

  it("gives task.read everyone's runs, the running ones apart and newest first", async () => {
    signInAs("admin");
    const index = await listRuns({});

    expect(idsOf(index.running)).toEqual(["T-9916", "T-9915"]);
    expect(handIdsOf(index.finished)).toEqual([
      "T-9912",
      "T-9914",
      "T-9909",
      "T-9905",
      "T-9893",
      "T-9901",
      "T-9890",
      "T-9884",
      "T-9897",
      "T-9850",
    ]);
    expect(index.schedules).toEqual({ activeCount: 6, pausedCount: 1 });
    expect(index.retention).toEqual({ days: 90, failedDays: 365 });
  });

  it("works out how far a running run has got at the server's moment", async () => {
    signInAs("admin");
    const { running, asOf } = await listRuns({});
    const recheck = running.find((run) => run.id === "T-9915");

    expect(new Date(asOf)).toEqual(new Date(2026, 5, 25, 10, 40));
    expect(recheck).toMatchObject({
      state: "Running",
      doneCount: 7,
      itemCount: 12,
      errorCount: 1,
      changes: null,
      finishedAt: null,
    });
    expect(recheck?.secondsLeft).toBe(125);
  });

  it("calls a finished run with errors Done with errors and names what it changed", async () => {
    signInAs("admin");
    const sweep = (await listRuns({})).finished.find((run) => run.id === "T-9905");

    expect(sweep).toMatchObject({ state: "DoneWithErrors", errorCount: 3 });
    expect(sweep?.changes?.[0]?.path).toBe("/review/documents?defect=pi9");
  });

  it("gives task.read_own only the runs its holder started, and no schedules", async () => {
    signInAs("curator");
    const index = await listRuns({});

    expect(idsOf(index.running)).toEqual(["T-9915"]);
    expect(idsOf(index.finished)).toEqual(["T-9893"]);
    expect(index.tiles.nextRun).toBeNull();
    expect(index.nextRuns).toEqual([]);
    expect(index.schedules).toBeNull();
  });

  it("refuses the tasks view to staff", async () => {
    signInAs("staff");
    expect(await refusalOf(listRuns({}))).toMatchObject({ status: 403 });
  });

  it("filters the finished runs, and a state leaves out the running ones", async () => {
    signInAs("admin");
    const failed = await listRuns({ states: ["Failed"] });
    const kramerius = await listRuns({ instanceIds: ["pi4"] });

    expect(handIdsOf(failed.finished)).toEqual(["T-9897"]);
    expect(failed.running).toEqual([]);
    expect(idsOf(kramerius.running)).toEqual(["T-9916"]);
    expect(handIdsOf(kramerius.finished)).toEqual(["T-9914", "T-9884"]);
    expect(idsOf((await listRuns({ states: ["Running"] })).running)).toEqual(["T-9916", "T-9915"]);
    expect((await listRuns({ states: ["Running"] })).finished).toEqual([]);
    expect(
      (await listRuns({ states: ["Failed"], started: { preset: "last-7-days" } })).finished,
    ).toEqual([]);
  });

  it("counts each field's values over every other filter", async () => {
    signInAs("admin");
    const { facets } = await listRuns({ triggers: ["manual"] });

    expect(facets.triggers).toContainEqual({ value: "schedule", count: 6 + historicalRuns.length });
    expect(facets.startedBy).toEqual(
      expect.arrayContaining([
        { value: "u8", count: 2 },
        { value: "u3", count: 1 },
      ]),
    );
    expect(facets.states).toContainEqual({ value: "Cancelled", count: 1 });
  });

  it("searches what ran and its number", async () => {
    signInAs("admin");

    expect(handIdsOf((await listRuns({ search: "aleph" })).finished)).toEqual(["T-9912"]);
    expect(idsOf((await listRuns({ search: "9897" })).finished)).toEqual(["T-9897"]);
  });

  it("orders the next run of every active schedule and repeat", async () => {
    signInAs("admin");
    const { tiles, nextRuns } = await listRuns({});

    expect(tiles).toMatchObject({
      runningCount: 2,
      failedCount: 0,
      withErrorsCount: 1,
      nextRun: { name: "MZK Aleph — catalog resync" },
    });
    expect(new Date(tiles.nextRun?.at ?? "")).toEqual(new Date(2026, 5, 25, 10, 45));
    expect(new Date(tiles.lastFailureAt ?? "")).toEqual(new Date(2026, 5, 14, 10, 31));
    expect(nextRuns[0]).toMatchObject({
      name: "MZK Aleph — catalog resync",
      path: "/schedules?s=s1",
    });
    expect(nextRuns.map((run) => run.at)).toEqual(nextRuns.map((run) => run.at).toSorted());
  });
});

describe("listRunningRuns", () => {
  it("gives the sidebar's panel what is running in the caller's reach", async () => {
    signInAs("curator");

    expect(idsOf((await listRunningRuns()).runs)).toEqual(["T-9915"]);
  });
});

describe("getRun", () => {
  it("gives a run's errors, its first items and its log", async () => {
    signInAs("admin");
    const detail = await getRun("T-9905");

    expect(detail.errors.map((item) => item.iterationId)).toEqual(["IT10", "IT13", "IT12"]);
    expect(detail.errors[0]?.title).not.toBe("");
    expect(detail.items).toHaveLength(9);
    expect(detail.log.filter((line) => line.isError)).toHaveLength(3);
    expect(detail.log.at(-1)?.text).toBe("finished — done with errors");
  });

  it("does not show a person a run they did not start", async () => {
    signInAs("curator");

    expect(await refusalOf(getRun("T-9905"))).toMatchObject({ status: 404 });
  });

  it("serves the log as text", async () => {
    signInAs("admin");

    expect(await getRunLog("T-9897")).toContain("Catalog adapter returned HTTP 502");
  });

  it("names plugin instances in the reference data", async () => {
    signInAs("staff");

    expect((await listPluginInstances()).find((instance) => instance.id === "pi4")?.name).toBe(
      "MZK Kramerius",
    );
  });
});

describe("acts on a run", () => {
  it("lets whoever started a run cancel it, where it stands", async () => {
    signInAs("curator");
    const cancelled = await cancelRun("T-9915");

    expect(cancelled).toMatchObject({ state: "Cancelled", doneCount: 7, cancelledBy: "u8" });
    expect(await refusalOf(cancelRun("T-9915"))).toMatchObject({
      status: 409,
      code: "task.not_running",
    });
  });

  it("does not let task.read_own reach another person's run", async () => {
    signInAs("digitization");

    expect(await refusalOf(cancelRun("T-9916"))).toMatchObject({ status: 404 });
  });

  it("runs a failed plugin run again as a new run, leaving the old one", async () => {
    signInAs("admin");
    const again = await runAgain("T-9897");

    expect(again).toMatchObject({
      id: "T-9917",
      state: "Running",
      rerunOf: "T-9897",
      startedBy: "u3",
      trigger: { kind: "manual", from: { label: "Tasks" } },
    });
    expect((await getRun("T-9897")).run.state).toBe("Failed");
  });

  it("lets the person run their own cancelled run again without plugin.run", async () => {
    signInAs("curator");

    expect(await runAgain("T-9915")).toMatchObject({ rerunOf: "T-9915", startedBy: "u8" });
  });

  it("never runs a core job again by hand", async () => {
    signInAs("admin");

    expect(await refusalOf(runAgain("T-9850"))).toMatchObject({
      status: 409,
      code: "task.not_rerunnable",
    });
  });
});

describe("saveRetention", () => {
  it("is task.schedule's", async () => {
    signInAs("curator");

    expect(await refusalOf(saveRetention({ days: 30, failedDays: 365 }))).toMatchObject({
      status: 403,
    });
  });

  it("keeps failed and cancelled runs at least as long as the rest", async () => {
    signInAs("admin");

    expect(await refusalOf(saveRetention({ days: 90, failedDays: 30 }))).toMatchObject({
      status: 422,
      code: "retention.failed_shorter",
    });
  });

  it("lets a run older than retention go", async () => {
    signInAs("admin");
    await saveRetention({ days: 7, failedDays: 365 });

    expect(idsOf((await listRuns({})).finished)).not.toContain("T-9850");
    expect(idsOf((await listRuns({})).finished)).toContain("T-9897");
  });
});
