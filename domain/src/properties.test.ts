import { describe, expect, it } from "bun:test";
import type { PropertyDefinition } from "./properties";
import { enumValueNameOf, formatPropertyValue, propertyNameOf } from "./properties";

const enumDefinition = {
  names: { en: "Size", cs: "Formát" },
  type: {
    kind: "enum",
    values: [{ value: "A4", names: { en: "A4 sheet", cs: "Arch A4" } }],
  },
} as unknown as PropertyDefinition;
const yesNo = {
  names: { en: "Fragile", cs: "Křehké" },
  type: { kind: "yesNo" },
} as unknown as PropertyDefinition;

// UI-names: a property, its enum values and its values in the language asked for.
describe("property names", () => {
  it("names a property and its enum values in either language", () => {
    expect(propertyNameOf(enumDefinition, "cs")).toBe("Formát");
    expect(propertyNameOf(enumDefinition, "en")).toBe("Size");
    expect(enumValueNameOf(enumDefinition, "A4", "cs")).toBe("Arch A4");
    expect(enumValueNameOf(enumDefinition, "A3", "cs")).toBe("A3");
  });

  it("words a value in either language", () => {
    expect(formatPropertyValue(enumDefinition, "A4", "cs")).toBe("Arch A4");
    expect(formatPropertyValue(yesNo, true, "cs")).toBe("Ano");
    expect(formatPropertyValue(yesNo, false, "en")).toBe("No");
  });
});
