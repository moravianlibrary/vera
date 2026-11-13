import { describe, expect, it } from "bun:test";
import { namesAfterEdit } from "./names";

describe("namesAfterEdit", () => {
  it("changes the current language and keeps the loaded other language", () => {
    expect(namesAfterEdit({ cs: "Původní", en: "Loaded" }, "cs", "Nové")).toEqual({
      cs: "Nové",
      en: "Loaded",
    });
  });
});
