// Schedules end to end against the mock server over HTTP: who sees them, each row's last and next
// run and its runs over the timeline's window, the repeats beside them, and making, editing,
// pausing, resuming, running and deleting one. The mock's clock stands still at the demo's moment,
// Thursday 2026-06-25 10:40. The acts change the mock's state, so they come last.

import type { ScheduleIndex } from "@vera/contract/schedules";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  pauseSchedule,
  resumeSchedule,
  runScheduleNow,
  saveSchedule,
} from "@/api/schedules";
import { listRuns } from "@/api/tasks";
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

const rowOf = (index: ScheduleIndex, scheduleId: string) =>
  index.schedules.find((row) => row.id === scheduleId);

const draft = {
  name: "RDCZ — nightly check",
  cadence: { every: "day" as const, at: "03:30" },
  overlap: "wait" as const,
};

describe("listSchedules", () => {
  it("is task.read's", async () => {
    signInAs("curator");

    expect(await refusalOf(listSchedules("day"))).toMatchObject({ status: 403 });
  });

  it("lists the plugin schedules, then the intention repeats", async () => {
    signInAs("admin");
    const index = await listSchedules("day");

    expect(index.schedules.map((row) => row.id)).toEqual([
      "s1",
      "s6",
      "s7",
      "s2",
      "s3",
      "s4",
      "s5",
      "t1",
    ]);
    expect(rowOf(index, "t1")).toMatchObject({
      name: "Monthly output — next period",
      source: { kind: "repeat", templateId: "t1" },
    });
    expect(new Date(rowOf(index, "t1")?.nextAt ?? "")).toEqual(new Date(2026, 6, 1));
    expect(index.runningCount).toBe(2);
  });

  it("gives each its last run, its next, and none while paused", async () => {
    signInAs("admin");
    const index = await listSchedules("day");

    expect(rowOf(index, "s2")?.lastRun).toMatchObject({ id: "T-9916", state: "Running" });
    // Two runs by hand, and the generated history.
    const history = historicalRuns.filter((run) => run.instanceId === "pi4").length;
    expect(rowOf(index, "s2")?.runCount).toBe(2 + history);
    expect(new Date(rowOf(index, "s1")?.nextAt ?? "")).toEqual(new Date(2026, 5, 25, 10, 45));
    expect(rowOf(index, "s7")).toMatchObject({ nextAt: null, window: { runCount: 0 } });
    expect(rowOf(index, "s7")?.pause?.reason).toBe("VKOL is migrating its catalog until 1 July.");
  });

  it("lists the runs over the window, and only counts a crowded one", async () => {
    signInAs("admin");
    const day = await listSchedules("day");
    const week = await listSchedules("week");

    expect(rowOf(day, "s3")?.window.runsAt.map((at) => new Date(at).getHours())).toEqual([
      12, 18, 0, 6,
    ]);
    expect(rowOf(day, "s1")?.window).toEqual({ runCount: 96, runsAt: [] });
    expect(rowOf(day, "s5")?.window.runCount).toBe(0);
    expect(rowOf(week, "s5")?.window.runCount).toBe(1);
  });
});

describe("changing a schedule", () => {
  it("is task.schedule's", async () => {
    signInAs("digitization");

    expect(await refusalOf(createSchedule({ ...draft, instanceId: "pi5" }))).toMatchObject({
      status: 403,
    });
  });

  it("refuses an interval under 5 minutes", async () => {
    signInAs("admin");
    const tooOften = {
      ...draft,
      instanceId: "pi5",
      cadence: { every: "minutes" as const, interval: 3 },
    };

    expect(await refusalOf(createSchedule(tooOften))).toMatchObject({
      status: 422,
      code: "schedule.too_often",
    });
  });

  it("refuses a plugin that runs only while somebody uses it", async () => {
    signInAs("admin");

    expect(await refusalOf(createSchedule({ ...draft, instanceId: "pi14" }))).toMatchObject({
      status: 422,
      code: "schedule.not_schedulable",
    });
  });

  it("makes a schedule and edits it", async () => {
    signInAs("admin");
    const made = await createSchedule({ ...draft, instanceId: "pi5" });

    expect(made).toMatchObject({ id: "s8", createdBy: "u3", since: "2026-06-25" });
    expect(new Date(made.nextAt ?? "")).toEqual(new Date(2026, 5, 26, 3, 30));

    const saved = await saveSchedule("s8", {
      ...draft,
      cadence: { every: "week", weekday: 0, at: "04:00" },
    });

    expect(new Date(saved.nextAt ?? "")).toEqual(new Date(2026, 5, 28, 4, 0));
  });

  it("never changes a repeat here", async () => {
    signInAs("admin");

    expect(await refusalOf(saveSchedule("t1", draft))).toMatchObject({ status: 404 });
  });

  it("pauses with a reason and resumes", async () => {
    signInAs("admin");

    expect(await refusalOf(pauseSchedule("s3", { reason: " " }))).toMatchObject({ status: 422 });

    const paused = await pauseSchedule("s3", { reason: "RDCZ maintenance window." });

    expect(paused).toMatchObject({ nextAt: null, pause: { pausedBy: "u3" } });
    expect(await refusalOf(pauseSchedule("s3", { reason: "Again." }))).toMatchObject({
      status: 409,
      code: "schedule.already_paused",
    });
    expect((await resumeSchedule("s3")).pause).toBeNull();
  });

  it("runs one now by hand, leaving the schedule as it was", async () => {
    signInAs("admin");
    const run = await runScheduleNow("s3");

    expect(run).toMatchObject({
      state: "Running",
      itemCount: 1204,
      trigger: { kind: "manual", from: { label: "Schedules", path: "/schedules?s=s3" } },
    });
    expect((await listRuns({})).running.map(({ id }) => id)).toContain(run.id);
  });

  it("deletes one, and its runs stay", async () => {
    signInAs("admin");
    await deleteSchedule("s4");

    expect(rowOf(await listSchedules("day"), "s4")).toBeUndefined();
    expect((await listRuns({})).finished.map(({ id }) => id)).toContain("T-9905");
  });
});
