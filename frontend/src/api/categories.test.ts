// Categories end to end against the mock server over HTTP: who may read the tree, what custody
// reaches and from where, and the selected mix over the tree, the Primary one by default; then
// changing the tree, inside custody: creating, moving, deleting, refining a leaf that holds
// documents, and writing a category's custody set. The changes stay in the mock's state, so each
// test changes its own categories.

import type { CategoryIndex } from "@vera/contract/categories";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createCategory,
  deleteCategory,
  getCategoryImpact,
  getCategoryIndex,
  refineCategory,
  saveCategory,
  saveCategoryCustody,
} from "@/api/categories";
import { ApiError } from "@/api/http";
import { listCategories } from "@/api/reference";
import { getSession } from "@/api/session";
import type { MockUserProfile } from "@/config/env";
import { i18n } from "@/i18n";
import { database } from "@/mocks/database";
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
    signInAs("staff");
    expect(await statusOf(getCategoryIndex())).toBe(403);
  });

  it("PLAN-house-mix: gives the tree and custody without a mix to someone without mix.read", async () => {
    signInAs("curator");

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

  it("reads the Primary mix, of the whole", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex();

    expect(index.mix?.intention.id).toBe("i4");
    expect(index.mix?.mixId).toBe("d1");
    expect(mixNodeOf(index, "c2")).toMatchObject({ share: 45, ofWhole: 45 });
    expect(mixNodeOf(index, "c21").ofWhole).toBeCloseTo(13.5);
  });

  it("shows a mix definition without inventing actual output", async () => {
    signInAs("digitization");

    const index = await getCategoryIndex();
    const tops = ["c1", "c2", "c3", "c4"].map((id) => mixNodeOf(index, id).actual ?? 0);

    expect(index.mix?.outputPages).toBe(0);
    expect(tops.reduce((sum, actual) => sum + actual, 0)).toBe(0);
  });
});

describe("the session's custody", () => {
  it("includes what is granted to the person directly", async () => {
    signInAs("curator");

    expect((await getSession()).custodyCategoryIds.toSorted()).toEqual(["c2", "c4"]);
  });
});

// The mock database starts from the same fixtures in every file, so a test reads what it changed.
const sharesOf = (distributionId: string) =>
  database.distributions.find((distribution) => distribution.id === distributionId)?.shares ?? {};

describe("changing the tree", () => {
  it("reads the Czech name and round-trips both names", async () => {
    signInAs("admin");
    await i18n.changeLanguage("cs");
    try {
      const categories = await listCategories();
      expect(categories.find(({ id }) => id === "c1")).toMatchObject({
        name: "Monografie",
        names: { en: "Monographs", cs: "Monografie" },
      });
      const created = await createCategory({
        names: { en: "Test category", cs: "Zkušební kategorie" },
        parentId: null,
      });
      expect(created).toMatchObject({
        name: "Zkušební kategorie",
        names: { en: "Test category", cs: "Zkušební kategorie" },
      });
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it("keeps sibling uniqueness within each language", async () => {
    signInAs("admin");
    const translated = await createCategory({ names: { cs: "Regional" }, parentId: "c2" });
    expect(translated.names).toEqual({ cs: "Regional" });
    expect(await statusOf(createCategory({ names: { cs: "Regionální" }, parentId: "c2" }))).toBe(
      409,
    );
  });

  it("lets a curator add a category inside their custody only, with no share anywhere", async () => {
    signInAs("curator");

    const created = await createCategory({ names: { en: " Moravian " }, parentId: "c2" });

    expect(created).toMatchObject({ names: { en: "Moravian" }, parentId: "c2" });
    expect(sharesOf("d1")[created.id]).toBeUndefined();
    expect(await statusOf(createCategory({ names: { en: "Atlases" }, parentId: "c1" }))).toBe(403);
    expect(await statusOf(createCategory({ names: { en: "Atlases" }, parentId: null }))).toBe(403);
  });

  it("refuses a name a sibling has, and a child under a leaf that holds documents", async () => {
    signInAs("admin");

    expect(await statusOf(createCategory({ names: { en: "regional" }, parentId: "c2" }))).toBe(409);
    expect(await statusOf(createCategory({ names: { en: "Brno" }, parentId: "c21" }))).toBe(409);
  });

  it("moves a category with its share left unallocated where it was", async () => {
    signInAs("admin");

    const periodicals = database.distributions.find((mix) => mix.id === "d2");
    const house = database.distributions.find((mix) => mix.id === "d1");
    if (periodicals === undefined || house === undefined) throw new Error("Missing fixture mix");
    const previousPeriodicals = periodicals;
    database.distributions = database.distributions.map((mix) =>
      mix.id === "d2"
        ? { ...mix, archivedAt: "2026-11-09T00:00:00Z", shares: { ...mix.shares, c23: 10 } }
        : mix,
    );

    await saveCategory("c23", { names: { en: "Specialist press" }, parentId: "c1" });
    const index = await getCategoryIndex();

    expect(sharesOf("d1").c23).toBeUndefined();
    expect(database.distributions.find((mix) => mix.id === "d1")).toMatchObject({
      revision: house.revision + 1,
      revisions: [
        ...house.revisions,
        {
          revision: house.revision + 1,
          shares: expect.not.objectContaining({ c23: expect.anything() }),
          at: expect.any(String),
          label: null,
        },
      ],
    });
    expect(database.distributions.find((mix) => mix.id === "d2")).toEqual({
      ...previousPeriodicals,
      archivedAt: "2026-11-09T00:00:00Z",
      shares: { ...previousPeriodicals.shares, c23: 10 },
    });
    database.distributions = database.distributions.map((mix) =>
      mix.id === "d2" ? previousPeriodicals : mix,
    );
    expect(index.mix?.nodes.find((node) => node.categoryId === "c2")).toMatchObject({
      unallocated: 20,
    });
    expect(index.mix?.nodes.find((node) => node.categoryId === "c1")?.noShareIds).toContain("c23");
    expect(
      await statusOf(saveCategory("c1", { names: { en: "Monographs" }, parentId: "c11" })),
    ).toBe(422);
  });

  it("renames a category without writing a mix revision", async () => {
    signInAs("admin");
    const category = database.categories.find((candidate) => candidate.id === "c23");
    if (category === undefined) throw new Error("No Specialist press category");
    const before = database.distributions.map((mix) => ({
      id: mix.id,
      revision: mix.revision,
      revisions: mix.revisions,
    }));

    await saveCategory("c23", {
      names: { en: "Specialist newspapers" },
      parentId: category.parentId,
    });

    expect(
      database.distributions.map(({ id, revision, revisions }) => ({ id, revision, revisions })),
    ).toEqual(before);
  });

  it("says which mixes give a share, naming only those the caller may read", async () => {
    signInAs("admin");
    const admin = await getCategoryImpact("c22");
    signInAs("curator");
    const curator = await getCategoryImpact("c22");

    expect(admin.shares.map((share) => [share.mix.name, share.share])).toEqual([
      ["House mix", 50],
      ["Periodicals push", 35],
    ]);
    expect(admin).toMatchObject({ documentCount: 6, otherMixCount: 0 });
    expect(curator).toMatchObject({ shares: [], otherMixCount: 2 });
  });

  it("deletes only an empty leaf, its custody going with it", async () => {
    signInAs("admin");
    const empty = await createCategory({ names: { en: "Posters" }, parentId: null });
    await saveCategoryCustody(empty.id, { groupIds: ["g3"], userIds: [] });
    const house = database.distributions.find((mix) => mix.id === "d1");
    const periodicals = database.distributions.find((mix) => mix.id === "d2");
    if (house === undefined || periodicals === undefined) throw new Error("Missing fixture mix");
    database.distributions = database.distributions.map((mix) =>
      mix.id === "d1"
        ? { ...mix, shares: { ...mix.shares, [empty.id]: 25 } }
        : mix.id === "d2"
          ? {
              ...mix,
              archivedAt: "2026-11-09T00:00:00Z",
              shares: { ...mix.shares, [empty.id]: 75 },
            }
          : mix,
    );

    await deleteCategory(empty.id);

    expect(sharesOf("d1")[empty.id]).toBeUndefined();
    expect(database.distributions.find((mix) => mix.id === "d1")?.revision).toBe(
      house.revision + 1,
    );
    expect(database.distributions.find((mix) => mix.id === "d1")?.revisions.at(-1)).toMatchObject({
      revision: house.revision + 1,
      shares: expect.not.objectContaining({ [empty.id]: expect.anything() }),
      at: expect.any(String),
      label: null,
    });
    expect(database.distributions.find((mix) => mix.id === "d2")).toMatchObject({
      ...periodicals,
      archivedAt: "2026-11-09T00:00:00Z",
      shares: { ...periodicals.shares, [empty.id]: 75 },
    });
    database.distributions = database.distributions.map((mix) =>
      mix.id === "d2" ? periodicals : mix,
    );
    expect(database.categories.some((category) => category.id === empty.id)).toBe(false);
    expect(database.groups.find((group) => group.id === "g3")?.categoryIds).toEqual([]);
    expect(await statusOf(deleteCategory("c21"))).toBe(409); // holds documents
    expect(await statusOf(deleteCategory("c3"))).toBe(409); // has children
  });

  it("writes custody whole, within the curator's own subtree, and the session follows", async () => {
    signInAs("curator");

    const node = await saveCategoryCustody("c22", { groupIds: [], userIds: ["u4"] });
    signInAs("staff");
    const session = await getSession();

    expect(node.grants).toEqual([{ kind: "person", id: "u4", name: expect.any(String) }]);
    expect(session.custodyCategoryIds).toContain("c22");
    signInAs("curator");
    expect(await statusOf(saveCategoryCustody("c11", { groupIds: [], userIds: ["u4"] }))).toBe(403);
  });

  it("refines a leaf: a child takes every document and all of the leaf's share", async () => {
    signInAs("curator");
    const documentCount = database.iterations.filter(
      ({ categoryId }) => categoryId === "c32",
    ).length;

    expect(await statusOf(refineCategory("c32", { names: { en: "Brno" } }))).toBe(403); // not theirs
    signInAs("admin");
    const child = await refineCategory("c32", { names: { en: "Before 1800" } });

    expect(child.parentId).toBe("c32");
    expect(database.iterations.filter(({ categoryId }) => categoryId === child.id)).toHaveLength(
      documentCount,
    );
    expect(sharesOf("d1")[child.id]).toBe(100);
    expect(sharesOf("d2")[child.id]).toBe(100);
    expect(await statusOf(refineCategory("c3", { names: { en: "Any" } }))).toBe(409); // not a leaf
  });
});
