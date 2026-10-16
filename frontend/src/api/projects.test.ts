// Projects end to end against the mock server over HTTP: who sees which project, the period from
// the dates, the target, planned, delivered and pace of its own intention, one project's
// proposals, lists and history, and its acts, which its intention follows. The acts change the
// mock's state, so each test takes its own project.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import type { IntentionIndex } from "@/api/intentions";
import { listIntentionIndex } from "@/api/intentions";
import {
  approveProject,
  createProject,
  deleteProject,
  findProject,
  isSameProjectQuery,
  listProjectIndex,
  parseProjectSearchParams,
  previewDecision,
  previewProjectChange,
  rejectProject,
  saveProject,
  saveProjectMembers,
  toProjectSearchParams,
} from "@/api/projects";
import { listGroups } from "@/api/reference";
import type { MockUserProfile } from "@/config/env";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function statusOf(call: Promise<unknown>): Promise<number | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.status : null;
  }
}

function intentionRowOf(index: IntentionIndex, intentionId: string) {
  return index.rows.find((row) => row.intention.id === intentionId);
}

const draft = {
  name: "Kartografické sbírky",
  description: "Maps from the Brno collections.",
  startsOn: "2026-09-01",
  endsOn: "2027-08-31",
  targetPages: 1000,
};

describe("listProjectIndex", () => {
  it("round-trips its URL filters and treats reordered selections as one lens", () => {
    const query = {
      search: " Brno ",
      states: ["Proposed" as const, "Approved" as const],
      periods: ["Active" as const],
      paces: ["BehindPace" as const],
      dates: { from: "2026-01-01", to: "2026-12-31" },
      timeElapsed: { from: 25, to: 75 },
      delivered: { from: 1000 },
    };
    expect(parseProjectSearchParams(toProjectSearchParams(query))).toEqual({
      ...query,
      search: "Brno",
    });
    expect(
      isSameProjectQuery(
        { states: ["Proposed", "Approved"] },
        { states: ["Approved", "Proposed"] },
      ),
    ).toBe(true);
    expect(
      parseProjectSearchParams(new URLSearchParams("state=Unknown,Rejected&dates=bad&elapsed=abc")),
    ).toMatchObject({
      states: ["Rejected"],
      dates: undefined,
      timeElapsed: undefined,
    });
  });

  it("searches name and description and filters by both enums", async () => {
    signInAs("curator");
    expect(
      (await listProjectIndex({ search: "ministry" })).rows.map((row) => row.project.id),
    ).toEqual(["p2"]);
    expect((await listProjectIndex({ search: "VISK" })).rows.length).toBeGreaterThan(1);
    const active = await listProjectIndex({ states: ["Approved"], periods: ["Active"] });
    expect(active.rows.length).toBeGreaterThan(0);
    expect(
      active.rows.every((row) => row.project.state === "Approved" && row.period === "Active"),
    ).toBe(true);
    expect(active.facets.states).toEqual(
      (await listProjectIndex({ periods: ["Active"] })).facets.states,
    );
    expect(active.facets.periods).toEqual(
      (await listProjectIndex({ states: ["Approved"] })).facets.periods,
    );
  });

  it("matches overlapping project dates, whole elapsed percentages, delivered pages and behind pace", async () => {
    signInAs("curator");
    const dates = await listProjectIndex({ dates: { from: "2027-07-01", to: "2027-07-31" } });
    expect(
      dates.rows.every(
        (row) => row.project.startsOn <= "2027-07-31" && row.project.endsOn >= "2027-07-01",
      ),
    ).toBe(true);
    expect((await listProjectIndex({ dates: { from: "2035-01-01" } })).total).toBe(0);
    const elapsed = await listProjectIndex({ timeElapsed: { to: 49 } });
    expect(elapsed.rows.every((row) => Math.round(row.timeElapsed * 100) <= 49)).toBe(true);
    const delivered = await listProjectIndex({ delivered: { from: 1 } });
    expect(delivered.rows.every((row) => row.deliveredPages > 0)).toBe(true);
    const behind = await listProjectIndex({ paces: ["BehindPace"] });
    expect(behind.rows.every((row) => row.verdict === "behindPace")).toBe(true);
    const onTrack = await listProjectIndex({ paces: ["OnTrack"] });
    expect(onTrack.rows.every((row) => row.verdict === "onPace")).toBe(true);
    const either = await listProjectIndex({ paces: ["BehindPace", "OnTrack"] });
    expect(either.total).toBe(behind.total + onTrack.total);
    expect(behind.facets.paces).toEqual((await listProjectIndex()).facets.paces);
  });
  it("is refused to a reader, who holds no project grant", async () => {
    signInAs("reader");

    expect(await statusOf(listProjectIndex())).toBe(403);
  });

  it("refuses staff and gives a decider every project", async () => {
    signInAs("staff");
    expect(await statusOf(listProjectIndex())).toBe(403);
    signInAs("curator");
    const curator = await listProjectIndex();

    expect(curator.rows).toHaveLength(9);
  });

  it("works out the period from the dates, and pace only for an approved, started one", async () => {
    signInAs("digitization");
    const { rows } = await listProjectIndex();
    const rowOf = (projectId: string) => rows.find((row) => row.project.id === projectId);

    expect(rowOf("p1")).toMatchObject({ period: "Active", verdict: expect.any(String) });
    expect(rowOf("p1")?.evenPace).toBeCloseTo(rowOf("p1")?.timeElapsed ?? -1);
    expect(rowOf("p4")).toMatchObject({ period: "Upcoming", verdict: null, evenPace: null });
    expect(rowOf("p5")).toMatchObject({ period: "Ended", timeElapsed: 1, evenPace: null });
    expect(rowOf("p5")?.verdict).toMatch(/targetMet|short/);
  });

  it("counts delivered as a part of planned, and the pending documents a decision acts on", async () => {
    signInAs("digitization");
    const { rows } = await listProjectIndex();

    for (const row of rows) {
      expect(row.deliveredPages).toBeLessThanOrEqual(row.plannedPages);
    }

    expect(rows.find((row) => row.project.id === "p8")).toMatchObject({
      pending: { documentCount: 2, withCopyCount: 1 },
      proposalCount: 3,
    });
    expect(rows.find((row) => row.project.id === "p1")?.memberGroups).toEqual([
      { id: "g2", name: "Digitization Office", peopleCount: 2 },
    ]);
  });
});

describe("findProject", () => {
  it("reads its target, planned, delivered and pace from its own intention", async () => {
    signInAs("digitization");
    const { rows } = await listProjectIndex();
    const intentions = await listIntentionIndex();
    const visk = rows.find((row) => row.project.id === "p2");
    const viskIntention = intentionRowOf(intentions, "i2");

    expect(visk?.intention).toEqual({ id: "i2", targetPages: 3000 });
    expect(viskIntention?.intention).toMatchObject({
      name: "VISK 7 / 2026",
      projectId: "p2",
      countsFrom: "2026-01-01",
      endsOn: "2026-12-31",
    });
    expect(visk).toMatchObject({
      plannedPages: viskIntention?.plannedPages,
      deliveredPages: viskIntention?.deliveredPages,
      verdict: viskIntention?.verdict,
    });
    // Another intention counting the same funding is a measure beside it, not its own.
    expect(rows.find((row) => row.project.id === "p3")?.intention.id).toBe("i13");
  });

  it("gives one row per proposed document, the lists carrying its items and its history", async () => {
    signInAs("digitization");
    const detail = await findProject("p8");
    const p1 = await findProject("p1");

    expect(detail?.proposals.map((proposal) => proposal.documentId).toSorted()).toEqual([
      "D29",
      "D30",
      "D31",
    ]);
    expect(detail?.proposals.find((proposal) => proposal.documentId === "D30")?.hasCopy).toBe(true);
    expect(p1?.lists.length).toBeGreaterThan(0);
    expect(p1?.funded.length).toBe(p1?.row.fundedCount);
    const times = p1?.log.map((entry) => entry.at) ?? [];
    expect(times).toEqual(times.toSorted().toReversed());
  });

  it("is null for a missing project", async () => {
    signInAs("curator");

    expect(await findProject("p404")).toBeNull();
  });

  it("offers every group as a possible member", async () => {
    signInAs("digitization");

    expect((await listGroups()).map((group) => group.id)).toEqual(["g1", "g2", "g3"]);
  });
});

describe("starting and running a project", () => {
  it("starts Proposed, the creator its manager and only member, logged", async () => {
    signInAs("curator");
    const created = await createProject(draft);

    expect(created.row.project).toMatchObject({
      state: "Proposed",
      managerId: "u8",
      memberIds: ["u8"],
      memberGroupIds: [],
    });
    expect(created.log.map((entry) => entry.event)).toEqual(["Created"]);
    expect(created.row.intention.targetPages).toBe(1000);
    // Listed on Intentions only once the project is decided.
    signInAs("digitization");
    expect(intentionRowOf(await listIntentionIndex(), created.row.intention.id)).toBeUndefined();
  });

  it("starts one without a target, whose intention then only counts output", async () => {
    signInAs("curator");
    const created = await createProject({ ...draft, name: "Bez cíle", targetPages: null });

    expect(created.row).toMatchObject({ intention: { targetPages: null }, verdict: null });
  });

  it("refuses an end before the start, and starting without project.create", async () => {
    signInAs("curator");
    expect(await statusOf(createProject({ ...draft, endsOn: "2026-01-01" }))).toBe(422);

    signInAs("staff");
    expect(await statusOf(createProject(draft))).toBe(403);
  });

  it("lets the manager edit what they manage, and nothing else", async () => {
    signInAs("curator");
    const created = await createProject(draft);
    const saved = await saveProject(created.row.project.id, {
      ...draft,
      name: "Brněnské kalendáře",
      endsOn: "2027-12-31",
    });

    expect(saved.row.project.endsOn).toBe("2027-12-31");
    // LOG-one-act-one-story: one save, one time, the entries in the order they were written.
    expect(saved.log.slice(0, 2).map((entry) => entry.event)).toEqual([
      "Dates or target changed",
      "Details changed",
    ]);
    expect(saved.log[1]?.at).toBe(saved.log[0]?.at);
    expect(await statusOf(saveProject("p1", draft))).toBe(403);
  });

  it("says what new dates do to its intention's figures, then moves its window", async () => {
    signInAs("digitization");
    const p1 = {
      name: "NDK Periodika",
      description: "National Digital Library grant.",
      startsOn: "2026-07-01",
      endsOn: "2027-06-30",
      targetPages: 5000,
    };
    const before = (await listProjectIndex()).rows.find((row) => row.project.id === "p1");
    const change = await previewProjectChange("p1", p1);

    expect(change.plannedPages.before).toBe(before?.plannedPages);
    expect(change.plannedPages.after).toBeLessThan(change.plannedPages.before);

    const saved = await saveProject("p1", p1);

    expect(saved.row).toMatchObject({
      intention: { id: "i12", targetPages: 5000 },
      plannedPages: change.plannedPages.after,
    });
    expect(intentionRowOf(await listIntentionIndex(), "i12")?.intention).toMatchObject({
      countsFrom: "2026-07-01",
      endsOn: "2027-06-30",
      targetPages: 5000,
    });
  });

  it("hands over the manager role; the old manager stays a member", async () => {
    signInAs("digitization");
    const created = await createProject(draft);
    const projectId = created.row.project.id;
    const saved = await saveProjectMembers(projectId, {
      managerId: "u4",
      memberIds: ["u2", "u4"],
      memberGroupIds: ["g3"],
    });

    expect(saved.row.project).toMatchObject({ managerId: "u4", memberIds: ["u2", "u4"] });
    expect(saved.row.memberGroups.map((group) => group.id)).toEqual(["g3"]);
    expect(saved.log.map((entry) => entry.event)).toContain("Manager changed");
    expect(
      await statusOf(
        saveProjectMembers(projectId, { managerId: "u5", memberIds: ["u4"], memberGroupIds: [] }),
      ),
    ).toBe(422);
  });

  it("deletes only a project nothing was proposed into", async () => {
    signInAs("digitization");
    const created = await createProject(draft);

    expect(await statusOf(deleteProject("p8"))).toBe(409);
    expect(await statusOf(deleteProject(created.row.project.id))).toBeNull();
    expect(await findProject(created.row.project.id)).toBeNull();
    expect(intentionRowOf(await listIntentionIndex(), created.row.intention.id)).toBeUndefined();
  });
});

describe("deciding a project", () => {
  it("is refused without project.decide", async () => {
    signInAs("staff");

    expect(await statusOf(previewDecision("p8"))).toBe(404);
    expect(await statusOf(approveProject("p8", { priority: "High" }))).toBe(404);
  });

  it("says what approving takes and skips, then approves at the priority it picks", async () => {
    signInAs("curator");
    const dryRun = await previewDecision("p8");

    expect(dryRun.approves.map((document) => document.documentId)).toEqual(["D31"]);
    expect(dryRun.skips.map((document) => document.documentId)).toEqual(["D30"]);

    const approved = await approveProject("p8", { priority: "High" });

    expect(approved.row.project).toMatchObject({ state: "Approved", priority: "High" });
    expect(approved.proposals.find((row) => row.documentId === "D31")?.decision).toBe("Approved");
    expect(approved.proposals.find((row) => row.documentId === "D30")?.decision).toBe("Pending");
    expect(approved.log[0]).toMatchObject({ event: "Approved" });
    expect(await statusOf(rejectProject("p8", { reason: "Too late" }))).toBe(409);
  });

  it("rejects with a reason, which is required", async () => {
    signInAs("curator");

    expect(await statusOf(rejectProject("p4", { reason: " " }))).toBe(422);

    const rejected = await rejectProject("p4", { reason: "The call was not won." });
    expect(rejected.row.project).toMatchObject({
      state: "Rejected",
      reason: "The call was not won.",
    });
    expect(rejected.row.verdict).toBeNull();
    signInAs("digitization");
    expect(
      intentionRowOf(await listIntentionIndex(), rejected.row.intention.id)?.intention.archived,
    ).not.toBeNull();
  });
});
