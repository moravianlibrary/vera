// Categories end to end against the mock server over HTTP: who may read the tree, what custody
// reaches and from where, and one intention's mix over the tree, which a tracker reads from its
// owner and a scoped intention only inside its scope.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CategoryIndex } from "@/api/categories";
import { getCategoryIndex } from "@/api/categories";
import { ApiError } from "@/api/http";
import { getSession } from "@/api/session";
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

function nodeOf(index: CategoryIndex, categoryId: string) {
  const node = index.nodes.find((candidate) => candidate.categoryId === categoryId);
  if (node === undefined) {
    throw new Error(`No category ${categoryId}`);
  }

  return node;
}

function mixNodeOf(index: CategoryIndex, categoryId: string) {
  const node = index.mix?.nodes.find((candidate) => candidate.categoryId === categoryId);
  if (node === undefined) {
    throw new Error(`No mix for ${categoryId}`);
  }

  return node;
}

describe("getCategoryIndex", () => {
  it("is refused to someone without category.read", async () => {
    signInAs("reader");

    expect(await statusOf(getCategoryIndex(null))).toBe(403);
  });

  it("gives the tree and custody without a mix to someone who cannot read intentions", async () => {
    signInAs("staff");

    const index = await getCategoryIndex(null);

    expect(index.mix).toBeNull();
    expect(index.picks).toEqual([]);
    expect(index.attention.sets).toEqual([]);
    expect(index.nodes).toHaveLength(11);
  });

  it("totals a branch from its leaves", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex(null);
    const branch = nodeOf(index, "c2");
    const leaves = ["c21", "c22", "c23"].map((id) => nodeOf(index, id));

    expect(branch.documentCount).toBe(leaves.reduce((sum, leaf) => sum + leaf.documentCount, 0));
    expect(branch.pages).toBe(leaves.reduce((sum, leaf) => sum + leaf.pages, 0));
    expect(index.totals.documentCount).toBeGreaterThan(branch.documentCount);
  });

  it("names who custody reaches, from the group or directly, and where it was granted", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex(null);

    expect(nodeOf(index, "c2").grants).toEqual([
      { kind: "group", id: "g1", name: "Periodicals Curators" },
    ]);
    expect(nodeOf(index, "c21").grants).toEqual([]);
    expect(nodeOf(index, "c21").reach.map((reach) => [reach.userId, reach.grantedOn.id])).toEqual([
      ["u1", "c2"],
      ["u8", "c2"],
    ]);
    expect(nodeOf(index, "c4").reach).toEqual([
      expect.objectContaining({ userId: "u8", group: null, grantedOn: { id: "c4", name: "Maps" } }),
    ]);
    expect(index.attention.unheldIds).toEqual(["c1", "c3"]);
  });

  it("reads Overall's mix with no intention asked, and with one the caller cannot see", async () => {
    signInAs("digitization");

    for (const asked of [null, "nope"]) {
      const index = await getCategoryIndex(asked);

      expect(index.mix?.intention.id).toBe("i4");
      expect(index.mix?.owner.id).toBe("i4");
      expect(mixNodeOf(index, "c2")).toMatchObject({ share: 45, ofWhole: 45 });
      expect(mixNodeOf(index, "c21").ofWhole).toBeCloseTo(13.5);
    }
  });

  it("reads a tracker's owner's mix, inside its scope only", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex("i1");

    expect(index.mix?.intention.id).toBe("i1");
    expect(index.mix?.owner.id).toBe("i8");
    expect(index.mix?.trackers.map(({ id }) => id).toSorted()).toEqual(["i1", "i3"]);
    // The scope is 100% of itself; its own share, and everything outside, is not used.
    expect(mixNodeOf(index, "c2")).toMatchObject({ share: null, ofWhole: 100 });
    expect(mixNodeOf(index, "c21")).toMatchObject({ share: 55, ofWhole: 55 });
    expect(mixNodeOf(index, "c1")).toMatchObject({ share: null, ofWhole: null, actual: null });
    expect(mixNodeOf(index, "c2")).toMatchObject({ unallocated: 10, noShareIds: ["c23"] });
    expect(index.mix?.unallocated).toBe(0);
  });

  it("measures actual on the intention's own output", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex(null);
    const tops = ["c1", "c2", "c3", "c4"].map((id) => mixNodeOf(index, id).actual ?? 0);

    expect(index.mix?.outputPages).toBeGreaterThan(0);
    expect(tops.reduce((sum, actual) => sum + actual, 0)).toBeCloseTo(100);
  });

  it("lists the owners and trackers not archived, and every set under 100 in their scope", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex(null);
    const pick = (id: string) => index.picks.find((candidate) => candidate.id === id);

    expect(pick("i4")).toMatchObject({ isOverall: true, tracks: null });
    expect(pick("i8")).toMatchObject({ tracks: null, trackerCount: 2 });
    expect(pick("i1")?.tracks).toEqual({ id: "i8", name: "Periodicals push — watch" });
    expect(pick("i9")).toBeUndefined();
    expect(index.attention.sets).toEqual([
      expect.objectContaining({ categoryId: "c2", unallocated: 10, noShareIds: ["c23"] }),
    ]);
  });

  it("offers an archived intention only when it is the one asked for", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex("i9");

    expect(index.mix?.intention.id).toBe("i9");
    expect(index.picks.some((pick) => pick.id === "i9")).toBe(true);
  });
});

describe("the session's custody", () => {
  it("includes what is granted to the person directly", async () => {
    signInAs("curator");

    expect((await getSession()).custodyCategoryIds.toSorted()).toEqual(["c2", "c4"]);
  });
});
