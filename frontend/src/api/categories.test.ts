// Categories end to end against the mock server over HTTP: who may read the tree, what custody
// reaches and from where, and Overall's mix over the tree, the only one Categories shows.

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

    expect(await statusOf(getCategoryIndex())).toBe(403);
  });

  it("gives the tree and custody without a mix to someone who cannot read intentions", async () => {
    signInAs("staff");

    const index = await getCategoryIndex();

    expect(index.mix).toBeNull();
    expect(index.nodes).toHaveLength(11);
  });

  it("totals a branch from its leaves", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex();
    const branch = nodeOf(index, "c2");
    const leaves = ["c21", "c22", "c23"].map((id) => nodeOf(index, id));

    expect(branch.documentCount).toBe(leaves.reduce((sum, leaf) => sum + leaf.documentCount, 0));
    expect(branch.pages).toBe(leaves.reduce((sum, leaf) => sum + leaf.pages, 0));
    expect(index.totals.documentCount).toBeGreaterThan(branch.documentCount);
  });

  it("names who custody reaches, from the group or directly, and where it was granted", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex();

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
    expect(index.unheldIds).toEqual(["c1", "c3"]);
  });

  it("reads Overall's mix, of the whole", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex();

    expect(index.mix?.intention.id).toBe("i4");
    expect(index.mix?.owner.id).toBe("i4");
    expect(mixNodeOf(index, "c2")).toMatchObject({ share: 45, ofWhole: 45 });
    expect(mixNodeOf(index, "c21").ofWhole).toBeCloseTo(13.5);
  });

  it("measures actual on the intention's own output", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex();
    const tops = ["c1", "c2", "c3", "c4"].map((id) => mixNodeOf(index, id).actual ?? 0);

    expect(index.mix?.outputPages).toBeGreaterThan(0);
    expect(tops.reduce((sum, actual) => sum + actual, 0)).toBeCloseTo(100);
  });
});

describe("the session's custody", () => {
  it("includes what is granted to the person directly", async () => {
    signInAs("curator");

    expect((await getSession()).custodyCategoryIds.toSorted()).toEqual(["c2", "c4"]);
  });
});
