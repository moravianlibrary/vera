// Categories match their own facts, while the tree keeps ancestor paths for context.

import { describe, expect, it } from "bun:test";
import type { Category } from "@vera/domain/entities";
import type { CategoryIndex } from "./categories";
import {
  isSameCategoryQuery,
  parseCategorySearchParams,
  toCategorySearchParams,
} from "./categories";
import { categoryFacets, matchingCategoryIds, visibleCategoryIds } from "./category-filters";

const categories = [
  { id: "c1", name: "Humanities", parentId: null },
  { id: "c2", name: "Legal history", parentId: "c1" },
  { id: "c3", name: "Philosophy", parentId: "c1" },
] as const satisfies readonly Category[];

const index = {
  nodes: [
    {
      categoryId: "c1",
      documentCount: 5,
      readyPages: 200,
      grants: [{ kind: "person", id: "u1", name: "Alice" }],
      reach: [{ userId: "u1", grantedOn: { id: "c1", name: "Humanities" } }],
    },
    {
      categoryId: "c2",
      documentCount: 3,
      readyPages: 120,
      grants: [],
      reach: [{ userId: "u1", grantedOn: { id: "c1", name: "Humanities" } }],
    },
    { categoryId: "c3", documentCount: 2, readyPages: 0, grants: [], reach: [] },
  ],
  mix: {
    intention: { scopeCategoryId: null },
    nodes: [
      { categoryId: "c1", share: 100, unallocated: 0 },
      { categoryId: "c2", share: 70, unallocated: 30 },
      { categoryId: "c3", share: null, unallocated: 0 },
    ],
  },
} as unknown as CategoryIndex;

describe("category filters", () => {
  it("matches category facts and keeps only ancestors as tree context", () => {
    const matches = matchingCategoryIds(categories, index, {
      search: "c2",
      kinds: ["Leaf"],
      custodies: ["Inherited"],
      attentions: ["Unallocated"],
      documents: { from: 3 },
    });

    expect([...matches]).toEqual(["c2"]);
    expect([...visibleCategoryIds(categories, matches)]).toEqual(["c1", "c2"]);
    expect([...matchingCategoryIds(categories, index, { custodies: ["Unheld"] })]).toEqual(["c3"]);
    expect([...matchingCategoryIds(categories, index, { attentions: ["NoShare"] })]).toEqual([
      "c3",
    ]);
  });

  it("counts each facet value against the other fields", () => {
    const facets = categoryFacets(categories, index, {
      kinds: ["Branch"],
      custodies: ["Unheld"],
    });

    expect(facets.kinds).toEqual([
      { value: "Branch", count: 0 },
      { value: "Leaf", count: 1 },
    ]);
    expect(facets.custodies).toEqual([
      { value: "Unheld", count: 0 },
      { value: "Direct", count: 1 },
      { value: "Inherited", count: 0 },
    ]);
  });

  it("does not infer mix attention without permission to read the mix", () => {
    const withoutMix = { ...index, mix: null };

    expect(categoryFacets(categories, withoutMix, {}).attentions).toEqual([]);
    expect(matchingCategoryIds(categories, withoutMix, { attentions: ["NoShare"] }).size).toBe(0);
  });

  it("does not call categories outside a scoped mix missing shares", () => {
    const mix = index.mix;
    if (mix === null) throw new Error("The fixture needs a mix");
    const scoped = {
      ...index,
      mix: {
        ...mix,
        intention: { ...mix.intention, scopeCategoryId: "c2" },
      },
    };

    expect(matchingCategoryIds(categories, scoped, { attentions: ["NoShare"] }).size).toBe(0);
  });

  it("round-trips filters in the URL and compares them without value order", () => {
    const query = {
      search: "legal",
      mixId: "i8",
      kinds: ["Leaf", "Branch"] as const,
      attentions: ["NoShare", "Unallocated"] as const,
      readyPages: { from: 100 },
    };
    expect(parseCategorySearchParams(toCategorySearchParams(query))).toEqual(query);
    expect(
      isSameCategoryQuery(query, {
        ...query,
        kinds: ["Branch", "Leaf"],
        attentions: ["Unallocated", "NoShare"],
      }),
    ).toBe(true);
  });
});
