// Custody reaches down from where it was granted, by the grant nearest the root, and the gaps
// nobody holds are reported at their highest point.

import { describe, expect, it } from "vitest";
import type { CustodyHolders } from "@/domain/categories";
import { custodyReachOf, unheldCategoriesOf } from "@/domain/categories";
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
