// Intentions end to end against the mock server over HTTP: who may read them, what the server
// counts for the demo's intentions, and whose mix each one reads; then the acts, which keep the
// mix rules (no chains, an owner others track moves them along) and change the mock's state, so
// each test makes its own intentions after the reading tests.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import type { IntentionDraft, IntentionIndex, IntentionTemplateDraft } from "@/api/intentions";
import {
  archiveIntention,
  createIntention,
  createIntentionTemplate,
  deleteIntention,
  listIntentionIndex,
  previewIntention,
  previewIntentionDeletion,
  saveIntention,
  saveIntentionTemplate,
  unarchiveIntention,
} from "@/api/intentions";
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

function rowOf(index: IntentionIndex, intentionId: string) {
  const row = index.rows.find((candidate) => candidate.intention.id === intentionId);
  if (row === undefined) {
    throw new Error(`No intention ${intentionId}`);
  }

  return row;
}

describe("listIntentionIndex", () => {
  it.each(["reader", "staff"] as const)(
    "is refused to %s, who holds no intention grant",
    async (profile: MockUserProfile) => {
      signInAs(profile);

      expect(await statusOf(listIntentionIndex())).toBe(403);
    },
  );

  it("gives a dig-curator every intention, the archived ones too, and the repeat", async () => {
    signInAs("digitization");
    const index = await listIntentionIndex();

    expect(index.rows).toHaveLength(11);
    expect(index.rows.filter((row) => row.intention.archived !== null)).toHaveLength(2);
    expect(index.templates.map((row) => [row.template.id, row.tracks?.name])).toEqual([
      ["t1", "House mix"],
    ]);
  });

  it("counts planned, delivered and output, overlapping and never added", async () => {
    signInAs("digitization");
    const index = await listIntentionIndex();
    const house = rowOf(index, "i4");
    const june = rowOf(index, "i7");

    expect([house.plannedPages, house.deliveredPages, house.outputPages]).toEqual([
      9277, 3285, 8975,
    ]);
    expect(house.lists.map((list) => list.id)).toEqual(["L-2026-014", "L-2026-015", "L-2026-012"]);
    // The June run's pages count towards June's catch-up and House mix at once.
    expect([june.state, june.deliveredPages, june.verdict]).toEqual(["Ended", 3285, "targetMet"]);
  });

  it("reads each target's pace, and what a behind one needs", async () => {
    signInAs("digitization");
    const index = await listIntentionIndex();

    expect(rowOf(index, "i5").verdict).toBe("onPace");
    expect(rowOf(index, "i3").verdict).toBe("fullyPlanned");
    expect(rowOf(index, "i3").timeElapsed).toBeNull();
    expect(rowOf(index, "i2")).toMatchObject({
      verdict: "behindPace",
      plannedPages: 0,
      catchUpPages: 1920,
      pagesPerWeekNeeded: 150,
    });
    expect(rowOf(index, "i8").verdict).toBeNull();
  });

  it("names the owner of the mix, never a tracker, and counts who tracks an owner", async () => {
    signInAs("digitization");
    const index = await listIntentionIndex();

    expect(rowOf(index, "i4").mix).toEqual({
      owner: { id: "i4", name: "House mix", isOverall: true },
      isOwn: true,
      trackerCount: 7,
    });
    expect(rowOf(index, "i8").mix.trackerCount).toBe(2);
    expect(rowOf(index, "i1").mix).toMatchObject({
      owner: { name: "Periodicals push — watch" },
      isOwn: false,
    });
  });

  it("reads a scoped mix within its scope, with what is unallocated", async () => {
    signInAs("digitization");
    const push = rowOf(await listIntentionIndex(), "i8");

    expect(push.scope?.path).toEqual(["Periodicals"]);
    expect(push.mixRows.map((row) => [row.name, row.intended, row.flag])).toEqual([
      ["Regional", 55, expect.any(String)],
      ["National", 35, expect.any(String)],
      ["Specialist", null, "noShare"],
    ]);
    expect(push.unallocated).toBe(10);
  });

  it("splits a target across its leaves", async () => {
    signInAs("digitization");
    const regional = rowOf(await listIntentionIndex(), "i3");

    expect(regional.fill.map((row) => [row.path, row.share, row.targetPages])).toEqual([
      [["Regional"], 100, 4000],
    ]);
  });
});

const draft = (name: string, overrides: Partial<IntentionDraft> = {}): IntentionDraft => ({
  name,
  description: "",
  funding: { kind: "any" },
  scopeCategoryId: null,
  countsFrom: "2026-07-01",
  endsOn: "2026-12-31",
  targetPages: 1000,
  mix: { kind: "track", ownerId: "i4", isMovingTrackers: false },
  ...overrides,
});

describe("creating and editing an intention", () => {
  it("tracks the owner it picks, or owns a copy of its mix", async () => {
    signInAs("digitization");
    const tracking = await createIntention(draft("Autumn push"));
    const copied = await createIntention(
      draft("Periodicals autumn", {
        scopeCategoryId: "c2",
        mix: { kind: "copy", fromId: "i8" },
      }),
    );
    const push = rowOf(await listIntentionIndex(), "i8");

    expect(tracking.mix).toMatchObject({ owner: { id: "i4" }, isOwn: false });
    expect(tracking.intention.distributionId).toBe("d1");
    expect(copied.mix).toEqual({
      owner: { id: copied.intention.id, name: "Periodicals autumn", isOverall: false },
      isOwn: true,
      trackerCount: 0,
    });
    expect(copied.intention.distributionId).not.toBe("d2");
    expect(copied.mixRows.map((row) => row.intended)).toEqual(
      push.mixRows.map((row) => row.intended),
    );
  });

  it("refuses a taken name, a tracker as the mix, and someone without intention.edit", async () => {
    signInAs("digitization");

    expect(await statusOf(createIntention(draft("house MIX")))).toBe(422);
    expect(
      await statusOf(
        createIntention(
          draft("Chained", { mix: { kind: "track", ownerId: "i2", isMovingTrackers: false } }),
        ),
      ),
    ).toBe(422);
    expect(await statusOf(createIntention(draft("Backwards", { endsOn: "2026-01-01" })))).toBe(422);

    signInAs("staff");
    expect(await statusOf(createIntention(draft("Not mine")))).toBe(403);
  });

  it("keeps the counting start, and the Overall intention's shape", async () => {
    signInAs("digitization");
    const created = await createIntention(draft("Fixed start"));
    const overall = rowOf(await listIntentionIndex(), "i4").intention;

    expect(
      await statusOf(
        saveIntention(created.intention.id, { ...draft("Fixed start"), countsFrom: "2026-08-01" }),
      ),
    ).toBe(422);
    expect(
      await statusOf(
        saveIntention("i4", {
          ...overall,
          targetPages: 500,
          mix: { kind: "keep" },
        }),
      ),
    ).toBe(422);
  });

  it("switches an owner others track only by moving them along", async () => {
    signInAs("digitization");
    const owner = await createIntention(draft("Own one", { mix: { kind: "copy", fromId: "i4" } }));
    const ownerId = owner.intention.id;
    const tracker = await createIntention(
      draft("Follows own one", { mix: { kind: "track", ownerId, isMovingTrackers: false } }),
    );
    const toOverall = (isMovingTrackers: boolean): IntentionDraft => ({
      ...draft("Own one"),
      mix: { kind: "track", ownerId: "i4", isMovingTrackers },
    });

    expect(rowOf(await listIntentionIndex(), ownerId).mix.trackerCount).toBe(1);
    expect(await statusOf(saveIntention(ownerId, toOverall(false)))).toBe(409);

    const moved = await saveIntention(ownerId, toOverall(true));
    const index = await listIntentionIndex();

    expect(moved.mix.owner.id).toBe("i4");
    expect(rowOf(index, tracker.intention.id).intention.tracksMixOf).toBe("i4");
    expect(rowOf(index, tracker.intention.id).mix.owner.name).toBe("House mix");
  });

  it("detaches a tracker onto a copy, leaving the owner's other trackers as they were", async () => {
    signInAs("digitization");
    const before = rowOf(await listIntentionIndex(), "i8").mix.trackerCount;
    const ndk = rowOf(await listIntentionIndex(), "i1").intention;
    const detached = await saveIntention("i1", {
      ...ndk,
      mix: { kind: "copy", fromId: "i8" },
    });

    expect(detached.mix.isOwn).toBe(true);
    expect(rowOf(await listIntentionIndex(), "i8").mix.trackerCount).toBe(before - 1);
  });

  it("counts a draft before it is saved, as the saved intention would", async () => {
    signInAs("digitization");
    const moravica = rowOf(await listIntentionIndex(), "i5");
    const preview = await previewIntention({
      ...moravica.intention,
      intentionId: "i5",
      mix: { kind: "track", ownerId: "i4", isMovingTrackers: false },
    });

    expect(preview).toMatchObject({
      plannedPages: moravica.plannedPages,
      deliveredPages: moravica.deliveredPages,
      outputPages: moravica.outputPages,
    });
  });

  it("sets the mix it would read beside the one it reads now, within the draft's scope", async () => {
    signInAs("digitization");
    const push = rowOf(await listIntentionIndex(), "i8").intention;
    const preview = await previewIntention({
      ...push,
      intentionId: "i8",
      mix: { kind: "track", ownerId: "i4", isMovingTrackers: true },
    });

    expect(preview.mix.map((row) => [row.name, row.before, row.after])).toEqual([
      ["Regional", 55, 30],
      ["National", 35, 50],
      ["Specialist", null, 20],
    ]);
  });
});

describe("archiving and deleting an intention", () => {
  it("archives only off the page, and never the Overall intention", async () => {
    signInAs("digitization");
    const created = await createIntention(draft("Short-lived"));
    const archived = await archiveIntention(created.intention.id);

    expect(archived.intention.archived?.actor).toEqual({ kind: "user", userId: "u2" });
    expect(archived.plannedPages).toBe(created.plannedPages);
    expect((await unarchiveIntention(created.intention.id)).intention.archived).toBeNull();
    expect(await statusOf(archiveIntention("i4"))).toBe(409);
  });

  it("says which lists were generated with it, and keeps an intention others track", async () => {
    signInAs("digitization");

    expect(await previewIntentionDeletion("i3")).toEqual({
      generatedLists: [{ id: "L-2026-015", name: "Regional weeklies" }],
    });
    expect(await statusOf(previewIntentionDeletion("i8"))).toBe(409);
    expect(await statusOf(deleteIntention("i4"))).toBe(409);
  });

  it("deletes an intention without touching any list", async () => {
    signInAs("digitization");
    const created = await createIntention(draft("Gone soon"));

    expect(await statusOf(deleteIntention(created.intention.id))).toBeNull();
    expect(
      (await listIntentionIndex()).rows.some((row) => row.intention.id === created.intention.id),
    ).toBe(false);
  });
});

describe("repeats", () => {
  const repeat: IntentionTemplateDraft = {
    namePattern: "Weekly maps — {period}",
    every: "month",
    funding: { kind: "any" },
    scopeCategoryId: "c3",
    tracksMixOf: "i4",
    targetPages: null,
    isArchivingPrevious: true,
  };

  it("is set only with intention.repeat, and only to track an owner", async () => {
    signInAs("digitization");
    expect(await statusOf(createIntentionTemplate(repeat))).toBe(403);

    signInAs("admin");
    expect(await statusOf(createIntentionTemplate({ ...repeat, tracksMixOf: "i2" }))).toBe(422);
    expect(await statusOf(createIntentionTemplate({ ...repeat, namePattern: "Maps" }))).toBe(422);
  });

  it("makes its first one when the next period starts, and moves it when the period changes", async () => {
    signInAs("admin");
    const created = await createIntentionTemplate(repeat);
    const saved = await saveIntentionTemplate(created.template.id, { ...repeat, every: "week" });

    expect(created).toMatchObject({
      template: { since: "2026-06-25", nextOn: "2026-07-01", createdBy: "u3" },
      tracks: { id: "i4", name: "House mix" },
    });
    expect(saved.template.nextOn).toBe("2026-06-29");
  });
});
