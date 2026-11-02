import { refusalCodes } from "@vera/contract/refusal-codes";
import { describe, expect, it } from "vitest";
import { resources } from "@/i18n";

describe("refusal messages", () => {
  it("has a message for every contract code", () => {
    for (const code of refusalCodes) {
      expect(resources.en.refusals).toHaveProperty(code);
      expect(resources.en.refusals[code as keyof typeof resources.en.refusals]).not.toBe("");
    }
  });
});
