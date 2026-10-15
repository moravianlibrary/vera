// Identifier formats and the pasted or uploaded list, read the way the Propose dialog reads them.

import { describe, expect, it } from "vitest";
import { defaultBatchNameOf, detectIdentifierType, parseProposalLines } from "@/domain/proposals";

describe("detectIdentifierType", () => {
  it.each([
    ["MZK01-001277001", "catalogId"],
    ["cnb001388120", "nbn"],
    ["978-80-7325-456-3", "isbn"],
    ["1801-1234", "issn"],
    ["MZK-2801-000341", "barcode"],
    ["Slovácké noviny", null],
  ] as const)("reads %s as %s", (value, expected) => {
    expect(detectIdentifierType(value)).toBe(expected);
  });

  it("never takes a value for a shelf mark, which has no common format (DOC-identifiers)", () => {
    expect(detectIdentifierType("ST1-0412")).toBeNull();
  });
});

describe("parseProposalLines", () => {
  it("reads identifier, volume and why, and skips blanks and comments", () => {
    const lines = parseProposalLines(
      "# from the seminar\nMZK01-001622010;1889;For the 1889 elections\n\ncnb001388120\n",
      null,
    );

    expect(lines).toEqual([
      {
        type: "catalogId",
        value: "MZK01-001622010",
        unit: "1889",
        reason: "For the 1889 elections",
      },
      { type: "nbn", value: "cnb001388120", unit: null, reason: null },
    ]);
  });

  it("reads a comma-separated export when no semicolon is there", () => {
    const [line] = parseProposalLines("MZK01-001277001,1940,Seminar", null);

    expect(line).toEqual({
      type: "catalogId",
      value: "MZK01-001277001",
      unit: "1940",
      reason: "Seminar",
    });
  });

  it("reads every line as the chosen type, and marks one that is not", () => {
    const lines = parseProposalLines("1801-1234\ncnb001388120", "issn");

    expect(lines.map((line) => line.type)).toEqual(["issn", null]);
  });

  it("reads any value as a shelf mark when that type is chosen (DOC-identifiers)", () => {
    const lines = parseProposalLines("ST1-0412;roč. 3\nII 12.345", "shelfMark");

    expect(lines.map((line) => line.type)).toEqual(["shelfMark", "shelfMark"]);
  });
});

describe("defaultBatchNameOf", () => {
  it("names a batch by when it came in, in the library's time (ENT-batch)", () => {
    expect(defaultBatchNameOf(new Date("2026-10-15T22:05:00Z"))).toBe("2026-10-16 00:05");
  });
});
