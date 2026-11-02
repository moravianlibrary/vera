import { refusalCodes } from "@vera/contract/refusal-codes";
import { eventCatalogue } from "@vera/domain/events";
import { describe, expect, it } from "vitest";
import { resources } from "@/i18n";

describe("refusal messages", () => {
  it("has a message for every contract code", () => {
    for (const code of refusalCodes) {
      expect(resources.en.refusals).toHaveProperty(code);
      expect(resources.en.refusals[code as keyof typeof resources.en.refusals]).not.toBe("");
    }
  });

  it("keeps refusal codes separate from event codes", () => {
    const eventCodes = new Set(Object.keys(eventCatalogue));

    for (const code of refusalCodes) {
      expect(eventCodes.has(code), `${code} is also an event code`).toBe(false);
    }
  });
});
