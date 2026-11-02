import { describe, expect, it } from "vitest";
import { documentEmptyTextOf } from "@/features/documents/documents-page";

describe("My Documents empty copy", () => {
  it("names what is missing when All is empty and keeps filter copy when filtered", () => {
    expect(documentEmptyTextOf(true, false)).toBe("You have not asked for anything yet.");
    expect(documentEmptyTextOf(true, true)).toBe("Nothing matches. Clear a filter to see more.");
  });
});
