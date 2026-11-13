import { describe, expect, it } from "bun:test";
import { nameIn, namesSchema } from "./user-settings";

describe("names by language", () => {
  it("requires at least one trimmed, non-empty name", () => {
    expect(namesSchema.parse({ en: " English " })).toEqual({ en: "English" });
    expect(namesSchema.safeParse({ cs: "  ", en: "" }).success).toBe(false);
    expect(namesSchema.safeParse({}).success).toBe(false);
  });

  it("falls back to the other language", () => {
    expect(nameIn({ en: "English" }, "cs")).toBe("English");
    expect(nameIn({ cs: "Česky" }, "en")).toBe("Česky");
  });
});
