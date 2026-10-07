// The Categories page's URL, the Refine wizard's included, and a category's level.

import { describe, expect, it } from "vitest";
import { categoriesUrlStateOf, levelOf } from "@/features/categories/categories-view";
import { categories } from "@/mocks/fixtures/categories";

describe("the URL", () => {
  it("reads the category, none for the root, and whether it is being refined", () => {
    expect(categoriesUrlStateOf(new URLSearchParams("c=c21"))).toEqual({
      categoryId: "c21",
      isRefining: false,
    });
    expect(categoriesUrlStateOf(new URLSearchParams())).toEqual({
      categoryId: null,
      isRefining: false,
    });
    expect(categoriesUrlStateOf(new URLSearchParams("c=c21&refine=1")).isRefining).toBe(true);
  });
});

describe("levelOf", () => {
  it("counts the top level as 1", () => {
    expect(levelOf(categories, "c2")).toBe(1);
    expect(levelOf(categories, "c21")).toBe(2);
  });
});
