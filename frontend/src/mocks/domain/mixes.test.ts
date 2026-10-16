// A category's effective share is the product of the shares down its path, and nothing when a
// share on the way is missing.

import { effectiveShareOf, siblingSetOf } from "@vera/domain/mixes";
import { describe, expect, it } from "vitest";
import { categories } from "@/mocks/fixtures/categories";

describe("effectiveShareOf", () => {
  const shares = { c2: 45, c21: 30, c22: 50 };

  it("multiplies the shares from the top down", () => {
    expect(effectiveShareOf(categories, shares, "c21")).toBeCloseTo(13.5);
    expect(effectiveShareOf(categories, shares, "c2")).toBe(45);
  });

  it("is null where the category or one above it has no share", () => {
    expect(effectiveShareOf(categories, shares, "c23")).toBeNull();
    expect(effectiveShareOf(categories, shares, "c11")).toBeNull();
    expect(effectiveShareOf(categories, shares, "c99")).toBeNull();
  });
});

describe("siblingSetOf", () => {
  it("flags what the children leave unallocated, and those with no share", () => {
    expect(siblingSetOf(categories, { c21: 55, c22: 35 }, "c2")).toEqual({
      unallocated: 10,
      noShareIds: ["c23"],
    });
  });

  it("reads the top level for no parent, and nothing for a leaf", () => {
    expect(siblingSetOf(categories, { c1: 35, c2: 45, c3: 15, c4: 5 }, null)).toEqual({
      unallocated: 0,
      noShareIds: [],
    });
    expect(siblingSetOf(categories, {}, "c4")).toEqual({ unallocated: 0, noShareIds: [] });
  });
});
