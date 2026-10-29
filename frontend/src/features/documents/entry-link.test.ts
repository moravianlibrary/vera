import { describe, expect, it } from "vitest";
import { allowedReturn, entryAskOf, entryReasonLimit } from "@/features/documents/entry-link";

describe("entryAskOf", () => {
  it("reads a record link", () => {
    expect(entryAskOf(new URLSearchParams("record=NKC01-1&unit=vol1"))).toMatchObject({
      record: "NKC01-1",
      unit: "vol1",
    });
  });

  it("reads an identifier with its type", () => {
    expect(entryAskOf(new URLSearchParams("identifier=978123&type=ISBN")).identifier).toEqual({
      value: "978123",
      type: "ISBN",
    });
  });

  it("keeps source and return when no item is named", () => {
    expect(
      entryAskOf(new URLSearchParams("source=pi43&return=https%3A%2F%2Fwww.mzk.cz")),
    ).toMatchObject({
      record: null,
      identifier: null,
      sourceId: "pi43",
      returnTo: "https://www.mzk.cz",
    });
  });

  it("does not read an identifier without its type", () => {
    expect(entryAskOf(new URLSearchParams("identifier=978123")).identifier).toBeNull();
  });

  it("limits the reason", () => {
    expect(
      entryAskOf(new URLSearchParams(`reason=${"x".repeat(entryReasonLimit + 10)}`)).reason,
    ).toHaveLength(entryReasonLimit);
  });
});

describe("allowedReturn", () => {
  it("accepts an allowed origin", () => {
    expect(allowedReturn("https://www.mzk.cz/x", ["https://www.mzk.cz"])).toBe(
      "https://www.mzk.cz/x",
    );
  });

  it("refuses a different origin, a javascript URL and a bad URL", () => {
    for (const value of ["https://evil.example/", "javascript:alert(1)", "not a url"]) {
      expect(allowedReturn(value, ["https://www.mzk.cz"])).toBeNull();
    }
  });
});
