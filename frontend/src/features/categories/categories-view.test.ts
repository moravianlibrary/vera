// The Categories page's URL, the Show pick in effect, the search and the scope test.

import { describe, expect, it } from "vitest";
import {
  categoriesHrefOf,
  categoriesUrlStateOf,
  isOutOfScope,
  percentTextOf,
  searchedCategoriesOf,
  treeValueOf,
} from "@/features/categories/categories-view";
import { categories } from "@/mocks/fixtures/categories";

describe("the URL", () => {
  it("reads the category and the intention, none for the root and for Overall", () => {
    expect(categoriesUrlStateOf(new URLSearchParams("i=i1&c=c21"))).toEqual({
      categoryId: "c21",
      intentionId: "i1",
    });
    expect(categoriesUrlStateOf(new URLSearchParams())).toEqual({
      categoryId: null,
      intentionId: null,
    });
  });

  it("writes only what is set", () => {
    expect(categoriesHrefOf({ categoryId: "c2", intentionId: "i8" })).toBe("/categories?i=i8&c=c2");
    expect(categoriesHrefOf({ categoryId: null, intentionId: null })).toBe("/categories");
  });
});

describe("treeValueOf", () => {
  it("starts on Share of parent and keeps what was picked", () => {
    expect(treeValueOf(undefined, true)).toBe("share");
    expect(treeValueOf("pages", true)).toBe("pages");
  });

  it("counts documents for someone who cannot see a mix", () => {
    expect(treeValueOf(undefined, false)).toBe("documents");
    expect(treeValueOf("mix", false)).toBe("documents");
    expect(treeValueOf("ready", false)).toBe("ready");
  });
});

describe("searchedCategoriesOf", () => {
  it("keeps the matches and every category above them", () => {
    expect([...(searchedCategoriesOf(categories, " regional") ?? [])]).toEqual(["c2", "c21"]);
    expect(searchedCategoriesOf(categories, "  ")).toBeNull();
    expect(searchedCategoriesOf(categories, "nothing")?.size).toBe(0);
  });
});

describe("isOutOfScope", () => {
  const scoped = { intention: { scopeCategoryId: "c2" } } as never;
  const everything = { intention: { scopeCategoryId: null } } as never;

  it("puts the root and everything outside a scope out of it, the scope itself in", () => {
    expect(isOutOfScope(categories, scoped, null)).toBe(true);
    expect(isOutOfScope(categories, scoped, "c1")).toBe(true);
    expect(isOutOfScope(categories, scoped, "c2")).toBe(false);
    expect(isOutOfScope(categories, scoped, "c21")).toBe(false);
    expect(isOutOfScope(categories, everything, null)).toBe(false);
  });
});

describe("percentTextOf", () => {
  it("keeps one decimal where there is one", () => {
    expect(percentTextOf(13.5)).toBe("13.5%");
    expect(percentTextOf(45)).toBe("45%");
    expect(percentTextOf(65.43)).toBe("65.4%");
  });
});
