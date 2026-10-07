// The Show pick in effect on a category tree.

import { describe, expect, it } from "vitest";
import { countTreeValues, mixTreeValues, treeValueOf } from "@/components/category-tree-values";

describe("treeValueOf", () => {
  const everything = [...mixTreeValues, ...countTreeValues];

  it("starts on Share of parent and keeps what was picked", () => {
    expect(treeValueOf(undefined, everything)).toBe("share");
    expect(treeValueOf("pages", everything)).toBe("pages");
  });

  it("falls back to the first value the page offers", () => {
    expect(treeValueOf(undefined, countTreeValues)).toBe("documents");
    expect(treeValueOf("mix", countTreeValues)).toBe("documents");
    expect(treeValueOf("ready", countTreeValues)).toBe("ready");
    expect(treeValueOf("pages", mixTreeValues)).toBe("share");
  });
});
