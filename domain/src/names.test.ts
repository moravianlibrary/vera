import { describe, expect, it } from "bun:test";
import { nameIn, namesAfterEdit, namesToSave, otherLanguage } from "./names";

describe("namesAfterEdit", () => {
  it("changes the current language and keeps the loaded other language", () => {
    expect(namesAfterEdit({ cs: "Původní", en: "Loaded" }, "cs", "Nové")).toEqual({
      cs: "Nové",
      en: "Loaded",
    });
  });
});

describe("namesToSave", () => {
  it("trims each name and leaves blank languages out", () => {
    expect(namesToSave({ cs: "  Název  ", en: "  " })).toEqual({ cs: "Název" });
  });
});

describe("otherLanguage", () => {
  it("returns the other interface language", () => {
    expect(otherLanguage("cs")).toBe("en");
    expect(otherLanguage("en")).toBe("cs");
  });
});

describe("nameIn", () => {
  it("uses the other language when the requested one is missing", () => {
    expect(nameIn({ en: "Name" }, "cs")).toBe("Name");
  });
});
