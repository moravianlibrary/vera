// Digitization Lists end to end against the mock server over HTTP: who reads lists, what state
// and counts each one has from its dates and members, the pool and what review holds back, and
// saving the editor's draft. Saving changes the mock's state, so each test lists its own items.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { cancelIteration } from "@/api/iterations";
import {
  createList,
  deleteList,
  findList,
  generateDraft,
  isSameListQuery,
  listGenerators,
  listLists,
  listPool,
  markDone,
  markNotDigitizable,
  parseListSearchParams,
  previewDeletion,
  previewMarkDone,
  saveList,
  toListSearchParams,
} from "@/api/lists";
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

describe("the list query in the URL", () => {
  it("round-trips and drops what it does not know", () => {
    const params = toListSearchParams({ search: " weeklies ", states: ["Planned", "Done"] });

    expect(params.toString()).toBe("q=weeklies&state=Planned%2CDone");
    expect(parseListSearchParams(new URLSearchParams("state=Done,Lost&q="))).toEqual({
      search: undefined,
      states: ["Done"],
    });
  });

  it("reads two orders of the same states as one filter", () => {
    expect(isSameListQuery({ states: ["Planned", "Done"] }, { states: ["Done", "Planned"] })).toBe(
      true,
    );
  });
});

describe("listLists", () => {
  it("is refused without list.read", async () => {
    signInAs("curator");

    expect(await statusOf(listLists({}))).toBe(403);
  });

  it("orders running, then coming, then done, with the state worked out from the dates", async () => {
    signInAs("digitization");

    const page = await listLists({});

    expect(page.items.map((row) => [row.list.id, row.state])).toEqual([
      ["L-2026-014", "InProgress"],
      ["L-2026-015", "Planned"],
      ["L-2026-016", "Planned"],
      ["L-2026-012", "Done"],
    ]);
    expect(page.facets.states).toEqual([
      { value: "Planned", count: 2 },
      { value: "InProgress", count: 1 },
      { value: "Done", count: 1 },
    ]);
  });

  it("filters by state and searches name or whole ID", async () => {
    signInAs("digitization");

    const running = await listLists({ states: ["Planned", "InProgress"] });
    const byName = await listLists({ search: "weekl" });
    const byId = await listLists({ search: "l-2026-016" });

    expect(running.items.map((row) => row.list.id)).not.toContain("L-2026-012");
    expect(running.facets.states).toContainEqual({ value: "Done", count: 1 });
    expect(byName.items.map((row) => row.list.id)).toEqual(["L-2026-015"]);
    expect(byId.items.map((row) => row.list.id)).toEqual(["L-2026-016"]);
  });

  it("counts a member a gate stopped after listing as blocked", async () => {
    signInAs("digitization");

    const page = await listLists({ search: "L-2026-015" });

    expect(page.items[0]?.blockedCount).toBe(1); // IT25: a page-count defect found after listing
  });
});

describe("findList", () => {
  it("gives the members, highest priority first, with the blocker and history", async () => {
    signInAs("digitization");

    const detail = await findList("L-2026-015");

    expect(detail?.row.itemCount).toBe(detail?.members.length);
    expect(detail?.members.find((item) => item.iteration.id === "IT25")?.blocker).toBe(
      "ReviewNeeded",
    );
    expect(detail?.log.map((entry) => entry.event)).toContain("Created");
    const ranks = detail?.members.map((item) => item.iteration.priority) ?? [];
    expect(ranks.indexOf("Normal")).toBeGreaterThan(ranks.indexOf("High"));
  });

  it("is null for a list that does not exist", async () => {
    signInAs("digitization");

    expect(await findList("L-1999-001")).toBeNull();
  });
});

describe("listPool", () => {
  it("offers what is Ready, passes every gate and is on no list", async () => {
    signInAs("digitization");

    const pool = await listPool({});
    const ids = pool.items.map((item) => item.iteration.id);

    expect(ids).toEqual(expect.arrayContaining(["IT3", "IT26", "IT15"]));
    expect(ids).not.toContain("IT9"); // Ready, but cancelled
    expect(ids).not.toContain("IT2"); // on a list
    expect(pool.cancelledCount).toBeGreaterThanOrEqual(1);
    expect(pool.items.every((item) => item.iteration.listId === null)).toBe(true);
  });

  it("flags a copy that appeared after approval", async () => {
    signInAs("digitization");

    const pool = await listPool({ search: "IT15" });

    expect(pool.items[0]?.lateCopy?.foundAfterApproval).toBe(true);
  });

  it("narrows to a category's subtree and says what review holds back", async () => {
    signInAs("digitization");

    const pool = await listPool({ categoryId: "c2" });

    expect(pool.items.every((item) => item.iteration.categoryId.startsWith("c2"))).toBe(true);
    expect(pool.inReview.length).toBeGreaterThan(0);
    expect(pool.undecidedCount).toBeGreaterThan(0);
  });

  it("is refused to someone who only reads lists", async () => {
    signInAs("curator");

    expect(await statusOf(listPool({}))).toBe(403);
  });
});

describe("saving a list", () => {
  it("creates a list starting later, its members Planned and out of the pool", async () => {
    signInAs("digitization");

    const detail = await createList({
      name: "Monographs — September",
      startsOn: "2026-09-01",
      endsOn: "2026-09-18",
      targetPages: 2000,
      memberIds: ["IT30", "IT31"],
    });
    const pool = await listPool({});

    expect(detail.row.state).toBe("Planned");
    expect(detail.members.map((item) => item.iteration.progress)).toEqual(["Planned", "Planned"]);
    expect(pool.items.map((item) => item.iteration.id)).not.toContain("IT30");
    expect(detail.log.map((entry) => entry.event)).toEqual(
      expect.arrayContaining(["Created", "Members moved"]),
    );
  });

  it("starts now when no start is given", async () => {
    signInAs("digitization");

    const detail = await createList({
      name: "Early modern — now",
      startsOn: null,
      endsOn: "2026-07-31",
      targetPages: null,
      memberIds: ["IT33"],
    });

    expect(detail.row.state).toBe("InProgress");
    expect(detail.members[0]?.iteration.progress).toBe("InProgress");
  });

  it("takes one off back to Ready and puts another on", async () => {
    signInAs("digitization");
    const before = await findList("L-2026-014");
    const kept = before?.members.map((item) => item.iteration.id).filter((id) => id !== "IT23");

    const detail = await saveList("L-2026-014", {
      name: "Periodika — summer run",
      startsOn: "2026-06-22",
      endsOn: "2026-07-10",
      targetPages: 3500,
      memberIds: [...(kept ?? []), "IT27"],
    });
    const pool = await listPool({ search: "IT23" });

    expect(detail.members.map((item) => item.iteration.id)).toContain("IT27");
    expect(detail.members.find((item) => item.iteration.id === "IT27")?.iteration.progress).toBe(
      "InProgress",
    );
    expect(pool.items[0]?.iteration.progress).toBe("Ready");
    expect(detail.log.find((entry) => entry.event === "Members moved")?.detail).toBe("+1 −1");
  });

  it("refuses an item another list already took", async () => {
    signInAs("digitization");

    const status = await statusOf(
      createList({
        name: "Twice",
        startsOn: null,
        endsOn: "2026-07-31",
        targetPages: null,
        memberIds: ["IT2"],
      }),
    );

    expect(status).toBe(409);
  });

  it("refuses to change a Done list", async () => {
    signInAs("digitization");

    const status = await statusOf(
      saveList("L-2026-012", {
        name: "Moravica — June",
        startsOn: "2026-06-01",
        endsOn: "2026-06-19",
        targetPages: 3000,
        memberIds: [],
      }),
    );

    expect(status).toBe(409);
  });

  it("refuses an end before the start, and creating without list.create", async () => {
    signInAs("digitization");
    const backwards = statusOf(
      createList({
        name: "Backwards",
        startsOn: "2026-08-10",
        endsOn: "2026-08-01",
        targetPages: null,
        memberIds: [],
      }),
    );
    expect(await backwards).toBe(422);

    signInAs("curator");
    const refused = statusOf(
      createList({
        name: "Not mine",
        startsOn: null,
        endsOn: "2026-08-01",
        targetPages: null,
        memberIds: [],
      }),
    );
    expect(await refused).toBe(403);
  });
});

describe("generating a draft", () => {
  it("offers the running generators to whoever builds lists, and nobody else", async () => {
    signInAs("digitization");
    const generators = await listGenerators();

    expect(generators.map((generator) => [generator.plugin, generator.generatorClass])).toEqual([
      ["PriorityFirst", "RuleBased"],
      ["ShelfAdvisor", "AiBased"],
    ]);

    signInAs("curator");
    expect(await statusOf(listGenerators())).toBe(403);
  });

  it("picks only from the pool, each with its reason, and saves nothing", async () => {
    signInAs("digitization");
    const pool = await listPool({}, { limit: 200 });
    const poolIds = new Set(pool.items.map((item) => item.iteration.id));

    const draft = await generateDraft({
      generatorId: "pi14",
      pages: 4000,
      categoryIds: [],
      memberIds: [],
    });
    const after = await listPool({}, { limit: 200 });

    expect(draft.picks.length).toBeGreaterThan(0);
    expect(draft.picks.every(({ item }) => poolIds.has(item.iteration.id))).toBe(true);
    expect(draft.picks.every(({ reason }) => reason.includes("priority · asked"))).toBe(true);
    expect(draft.provenance).toMatchObject({ intentionId: "i4", generator: "PriorityFirst 1.2.0" });
    expect(after.total).toBe(pool.total);
  });

  it("is deterministic when rule-based, and keeps the current members fixed", async () => {
    signInAs("digitization");
    const request = { generatorId: "pi14", pages: 3000, categoryIds: [], memberIds: ["IT3"] };

    const first = await generateDraft(request);
    const second = await generateDraft(request);

    expect(first.picks.map(({ item }) => item.iteration.id)).toEqual(
      second.picks.map(({ item }) => item.iteration.id),
    );
    expect(first.picks.map(({ item }) => item.iteration.id)).not.toContain("IT3");
  });

  it("reports a category left out as short, and draws nothing from it", async () => {
    signInAs("digitization");

    const draft = await generateDraft({
      generatorId: "pi14",
      pages: 4000,
      categoryIds: ["c2"],
      memberIds: [],
    });

    expect(draft.picks.every(({ item }) => item.iteration.categoryId.startsWith("c2"))).toBe(true);
    expect(draft.shortfalls).toContainEqual(
      expect.objectContaining({ categoryId: "c11", cause: "leftOut" }),
    );
  });

  it("gives the AI generator's own sentence for each pick", async () => {
    signInAs("digitization");

    const draft = await generateDraft({
      generatorId: "pi15",
      pages: 4000,
      categoryIds: [],
      memberIds: [],
    });

    expect(draft.picks.some(({ reason }) => reason.includes("priority · asked"))).toBe(false);
  });

  it("records the generation when the draft is saved", async () => {
    signInAs("digitization");
    const draft = await generateDraft({
      generatorId: "pi14",
      pages: 1500,
      categoryIds: ["c3"],
      memberIds: [],
    });

    const detail = await createList({
      name: "Manuscripts — generated",
      startsOn: "2026-12-01",
      endsOn: "2026-12-18",
      targetPages: 1500,
      memberIds: draft.picks.map(({ item }) => item.iteration.id),
      generated: draft.provenance,
    });

    expect(detail.row.list.generated?.generator).toBe("PriorityFirst 1.2.0");
    expect(detail.log.map((entry) => entry.event)).toContain("Generated — PriorityFirst 1.2.0");
  });
});

describe("acting on a list", () => {
  it("marks an item that could not be digitized, and keeps it on the list", async () => {
    signInAs("digitization");
    const before = await findList("L-2026-014");
    const open = before?.members.find(
      (item) => item.iteration.cancellation === null && item.iteration.progress === "InProgress",
    );

    const detail = await markNotDigitizable("L-2026-014", open?.iteration.id ?? "", {
      message: "Pages too tightly bound to open safely.",
    });
    const marked = detail.members.find((item) => item.iteration.id === open?.iteration.id);

    expect(marked?.iteration.cancellation).toMatchObject({
      cause: "NotDigitizable",
      publicText: "Pages too tightly bound to open safely.",
    });
    expect(detail.row.notDigitizableCount).toBeGreaterThanOrEqual(1);
  });

  it("refuses to mark an item on a list that has not started", async () => {
    signInAs("digitization");

    expect(
      await statusOf(markNotDigitizable("L-2026-015", "IT25", { message: "Lost in the stacks." })),
    ).toBe(409);
  });

  it("takes an item cancelled from a list off it, out of the pool too", async () => {
    signInAs("digitization");
    const before = await findList("L-2026-014");
    const open = before?.members.find((item) => item.iteration.cancellation === null);
    const iterationId = open?.iteration.id ?? "";

    await cancelIteration(iterationId, { publicText: "Postponed.", internalText: null });
    const after = await findList("L-2026-014");
    const pool = await listPool({ search: iterationId });

    expect(after?.members.map((item) => item.iteration.id)).not.toContain(iterationId);
    expect(pool.items).toEqual([]);
  });

  it("counts what deleting does, then deletes: blocked ones back to Enqueued", async () => {
    signInAs("digitization");
    const dryRun = await previewDeletion("L-2026-015");

    expect(dryRun.toEnqueuedCount).toBe(1); // IT25, blocked since listing

    await deleteList("L-2026-015");
    const pool = await listPool({}, { limit: 200 });

    expect(await findList("L-2026-015")).toBeNull();
    expect(pool.items.map((item) => item.iteration.id)).not.toContain("IT25");
    expect(pool.total).toBeGreaterThanOrEqual(dryRun.toReady.itemCount);
  });

  it("refuses to delete a Done list, and to delete without list.delete", async () => {
    signInAs("digitization");
    expect(await statusOf(previewDeletion("L-2026-012"))).toBe(409);
    expect(await statusOf(deleteList("L-2026-012"))).toBe(409);

    signInAs("curator");
    expect(await statusOf(deleteList("L-2026-016"))).toBe(403);
  });

  it("marks a running list Done: its open members Digitized, the stopped ones not", async () => {
    signInAs("digitization");
    expect(await statusOf(previewMarkDone("L-2026-016"))).toBe(409); // still Planned

    const dryRun = await previewMarkDone("L-2026-014");
    const detail = await markDone("L-2026-014");

    expect(detail.row.state).toBe("Done");
    expect(detail.row.scannedItemCount).toBe(
      dryRun.toDigitized.itemCount + dryRun.alreadyScannedCount,
    );
    expect(
      detail.members
        .filter((item) => item.iteration.cancellation?.cause === "NotDigitizable")
        .every((item) => item.iteration.progress !== "Digitized"),
    ).toBe(true);
    expect(detail.log.map((entry) => entry.event)).toContain("Marked Done");
    expect(await statusOf(markDone("L-2026-014"))).toBe(409);
  });
});
