// Intentions end to end against the mock server over HTTP: who may read them, what the server
// counts for the demo's intentions, and whose mix each one reads.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import type { IntentionIndex } from "@/api/intentions";
import { listIntentionIndex } from "@/api/intentions";
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
