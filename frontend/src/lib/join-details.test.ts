import { describe, expect, it } from "vitest";
import { joinDetails } from "@/lib/join-details";

describe("joinDetails", () => {
  it("joins the parts with a middle dot", () => {
    expect(joinDetails(["MZK05-000009901", "Manuscript", "RKP-0341"])).toBe(
      "MZK05-000009901 · Manuscript · RKP-0341",
    );
  });

  it("skips missing, empty and blank parts", () => {
    expect(joinDetails(["54 documents", null, "", "  ", undefined, "Alice"])).toBe(
      "54 documents · Alice",
    );
  });

  it("is empty when no part is present", () => {
    expect(joinDetails([null, undefined, ""])).toBe("");
  });
});
