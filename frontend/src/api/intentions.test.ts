// Intentions end to end against the mock server over HTTP: who may read them, what the server
// counts for the demo's intentions, and which mix each one chose; then the acts, which change the
// mock's state, so each test makes its own intentions after the reading tests. An intention
// chooses a mix directly, and any number share one (PLAN-mix).

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
  previewCorrection,
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

async function problemCodeOf(call: Promise<unknown>): Promise<string | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? (error.problem?.code ?? null) : null;
  }
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

    // Two Proposed projects' own intentions are not listed yet; a Rejected one's is archived.
    expect(index.rows).toHaveLength(17);
    expect(index.rows.some((row) => row.intention.id === "i14")).toBe(false);
    expect(index.rows.filter((row) => row.intention.archived !== null)).toHaveLength(3);
    expect(index.templates.map((row) => [row.template.id, row.mix?.name])).toEqual([
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
      catchUpPages: 1440,
      pagesPerWeekNeeded: 120,
    });
    expect(rowOf(index, "i8").verdict).toBeNull();
  });

  it("PLAN-mix: names the mix each one chose, which several may share", async () => {
    signInAs("digitization");
    const index = await listIntentionIndex();

    expect(rowOf(index, "i4").mix).toMatchObject({ id: "d1", name: "House mix" });
    expect(rowOf(index, "i8").mix).toMatchObject({ id: "d2", name: "Periodicals push" });
    expect(rowOf(index, "i1").mix).toMatchObject({ id: "d2", name: "Periodicals push" });
  });

  it("shows a project's output and target without assigning a mix", async () => {
    signInAs("digitization");
    const project = rowOf(await listIntentionIndex(), "i2");
    expect(project.intention.distributionId).toBeNull();
    expect(project.mix).toBeNull();
    expect(project.mixRows.every((row) => row.intended === null && row.drift === null)).toBe(true);
    expect(project.fill.every((row) => row.share === null && row.targetPages === null)).toBe(true);
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
  mix: { kind: "use", mixId: "d1", revision: null },
  ...overrides,
});

describe("creating and editing an intention", () => {
  it("uses the mix it picks, its latest or a pinned revision, the Primary one, or none", async () => {
    signInAs("digitization");
    const latest = await createIntention(draft("Autumn push"));
    const pinned = await createIntention(
      draft("Periodicals autumn", {
        scopeCategoryId: "c2",
        mix: { kind: "use", mixId: "d2", revision: 2 },
      }),
    );
    const primary = await createIntention(draft("Primary one", { mix: { kind: "primary" } }));
    const none = await createIntention(draft("No mix", { mix: { kind: "none" } }));
    const push = rowOf(await listIntentionIndex(), "i8");

    expect(latest.intention).toMatchObject({ distributionId: "d1", mixRevision: null });
    expect(pinned.intention).toMatchObject({ distributionId: "d2", mixRevision: 2 });
    expect(pinned.mixRows.map((row) => row.intended)).toEqual(
      push.mixRows.map((row) => row.intended),
    );
    expect(primary.mix).toMatchObject({ id: "d1", name: "House mix" });
    expect(none.mix).toBeNull();
  });

  it("refuses a taken name, a mix that is not there, and someone without intention.edit", async () => {
    signInAs("digitization");

    expect(await statusOf(createIntention(draft("overall OUTPUT")))).toBe(422);
    expect(
      await statusOf(
        createIntention(draft("Nowhere", { mix: { kind: "use", mixId: "d9", revision: null } })),
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
          mix: { kind: "primary" },
        }),
      ),
    ).toBe(422);
  });

  it("moves to another mix and leaves the others on the old one as they were", async () => {
    signInAs("digitization");
    const ndk = rowOf(await listIntentionIndex(), "i1").intention;
    const moved = await saveIntention("i1", {
      ...ndk,
      mix: { kind: "use", mixId: "d1", revision: null },
    });

    expect(moved.mix?.id).toBe("d1");
    expect(rowOf(await listIntentionIndex(), "i3").mix?.id).toBe("d2");
  });

  it("counts a draft before it is saved, as the saved intention would", async () => {
    signInAs("digitization");
    const moravica = rowOf(await listIntentionIndex(), "i5");
    const preview = await previewIntention({
      ...moravica.intention,
      intentionId: "i5",
      mix: { kind: "use", mixId: "d1", revision: null },
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
      mix: { kind: "use", mixId: "d1", revision: null },
    });

    expect(preview.mix.map((row) => [row.name, row.before, row.after])).toEqual([
      ["Regional", 55, 30],
      ["National", 35, 50],
      ["Specialist", null, 20],
    ]);
  });
});

describe("a correcting run", () => {
  it("allocates the pages where output is short of the mix, before anything is generated", async () => {
    signInAs("digitization");
    const push = rowOf(await listIntentionIndex(), "i8");
    const preview = await previewCorrection("i8", 3000);
    const newPages = preview.rows.reduce((sum, row) => sum + row.newPages, 0);

    expect(preview.outputPages).toBe(push.outputPages);
    expect(preview.rows.map((row) => [row.name, row.intended])).toEqual([
      ["Regional", 55],
      ["National", 35],
      ["Specialist", null],
    ]);
    expect(preview.rows.find((row) => row.name === "Specialist")?.newPages).toBe(0);
    expect(Math.abs(newPages - 3000)).toBeLessThanOrEqual(20);
    expect(
      preview.rows.every((row) => row.shortPages === Math.max(0, row.newPages - row.readyPages)),
    ).toBe(true);
  });

  it("is only for whoever builds lists", async () => {
    signInAs("curator");

    expect(await statusOf(previewCorrection("i8", 3000))).toBe(403);
  });
});

describe("archiving and deleting an intention", () => {
  it("archives only off the page, and never the Overall intention", async () => {
    signInAs("digitization");
    const created = await createIntention(draft("Short-lived"));
    const archived = await archiveIntention(created.intention.id);

    expect(archived.intention.archived?.actor).toEqual({ kind: "user", userId: "u2" });
    expect(archived.plannedPages).toBe(created.plannedPages);
    expect(await statusOf(unarchiveIntention(created.intention.id))).toBe(409);
    expect(await statusOf(archiveIntention("i4"))).toBe(409);
  });

  it("says which lists were generated with it, whoever else uses its mix", async () => {
    signInAs("digitization");

    expect(await previewIntentionDeletion("i3")).toEqual({
      generatedLists: [{ id: "L-2026-015", name: "Regional weeklies" }],
    });
    expect(await statusOf(previewIntentionDeletion("i8"))).toBeNull();
    expect(await statusOf(deleteIntention("i4"))).toBe(409);
  });

  it("keeps a project's own intention with its project: its window, target and life", async () => {
    signInAs("digitization");
    const visk = rowOf(await listIntentionIndex(), "i2").intention;
    const kept = {
      name: visk.name,
      description: "The backlog.",
      funding: visk.funding,
      scopeCategoryId: "c1",
      countsFrom: visk.countsFrom,
      endsOn: visk.endsOn,
      targetPages: visk.targetPages,
      mix: { kind: "none" },
    } satisfies IntentionDraft;

    expect((await saveIntention("i2", kept)).intention).toMatchObject({
      scopeCategoryId: "c1",
      description: "The backlog.",
    });
    for (const changed of [{ targetPages: 100 }, { endsOn: null }, { name: "VISK" }]) {
      expect(await problemCodeOf(saveIntention("i2", { ...kept, ...changed }))).toBe(
        "intention.project",
      );
    }
    expect(await problemCodeOf(archiveIntention("i2"))).toBe("intention.project");
    expect(await problemCodeOf(deleteIntention("i2"))).toBe("intention.project");
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
    mix: { kind: "use", mixId: "d1", revision: null },
    targetPages: null,
    isArchivingPrevious: true,
  };

  it("is set only with intention.repeat, and only to a mix that is there", async () => {
    signInAs("digitization");
    expect(await statusOf(createIntentionTemplate(repeat))).toBe(403);

    signInAs("admin");
    expect(
      await statusOf(
        createIntentionTemplate({ ...repeat, mix: { kind: "use", mixId: "d9", revision: null } }),
      ),
    ).toBe(422);
    expect(await statusOf(createIntentionTemplate({ ...repeat, namePattern: "Maps" }))).toBe(422);
  });

  it("makes its first one when the next period starts, and moves it when the period changes", async () => {
    signInAs("admin");
    const created = await createIntentionTemplate(repeat);
    const saved = await saveIntentionTemplate(created.template.id, { ...repeat, every: "week" });

    expect(created).toMatchObject({
      template: { since: "2026-06-25", nextOn: "2026-07-01", createdBy: "u3" },
      mix: { id: "d1", name: "House mix" },
    });
    expect(saved.template.nextOn).toBe("2026-06-29");
  });
});
