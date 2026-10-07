// The category tree: custody reaches down from where it was granted, by the grant nearest the
// root, and the gaps nobody holds are reported at their highest point; a search keeps what is
// above a match; a scope holds its own subtree.

import { describe, expect, it } from "vitest";
import type { CustodyHolders } from "@/domain/categories";
import {
  custodyReachOf,
  isOutsideScope,
  searchedCategoriesOf,
  unheldCategoriesOf,
} from "@/domain/categories";
import { categories } from "@/mocks/fixtures/categories";

const holders: CustodyHolders = {
  groups: [
    { id: "g1", name: "Periodicals Curators", categoryIds: ["c2"], memberIds: ["u1", "u8"] },
  ],
  members: { c21: ["u1", "u3"], c11: ["u4"] },
};

describe("custodyReachOf", () => {
  it("names each person once, by the grant nearest the root", () => {
    expect(custodyReachOf(categories, holders, "c21")).toEqual([
      { userId: "u1", groupId: "g1", categoryId: "c2" },
      { userId: "u8", groupId: "g1", categoryId: "c2" },
      { userId: "u3", groupId: null, categoryId: "c21" },
    ]);
  });

  it("reaches nobody where nothing is granted on the way down", () => {
    expect(custodyReachOf(categories, holders, "c3")).toEqual([]);
  });
});

describe("unheldCategoriesOf", () => {
  it("reports an unheld top level whole, and a branch held below at its gaps", () => {
    expect(unheldCategoriesOf(categories, holders).map(({ id }) => id)).toEqual([
      "c12",
      "c3",
      "c4",
    ]);
  });
});

describe("searchedCategoriesOf", () => {
  it("keeps the matches and every category above them", () => {
    expect([...(searchedCategoriesOf(categories, " regional") ?? [])]).toEqual(["c2", "c21"]);
    expect(searchedCategoriesOf(categories, "  ")).toBeNull();
    expect(searchedCategoriesOf(categories, "nothing")?.size).toBe(0);
  });
});

describe("isOutsideScope", () => {
  it("puts the root and everything outside a scope out of it, the scope itself in", () => {
    expect(isOutsideScope(categories, "c2", null)).toBe(true);
    expect(isOutsideScope(categories, "c2", "c1")).toBe(true);
    expect(isOutsideScope(categories, "c2", "c2")).toBe(false);
    expect(isOutsideScope(categories, "c2", "c21")).toBe(false);
    expect(isOutsideScope(categories, null, null)).toBe(false);
  });
});
