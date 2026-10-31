// Identifier formats and the pasted or uploaded list, read the way the Propose dialog reads them,
// by the rules of MZK's predefined Identifier instances as the mock sends them.

import type { IdentifierTypeRule } from "@vera/domain/identifiers";
import { detectIdentifierType, isIdentifierOf, recognises } from "@vera/domain/identifiers";
import { defaultBatchNameOf, parseProposalLines } from "@vera/domain/proposals";
import { describe, expect, it } from "vitest";
import { identifierRules } from "@/mocks/identifiers";

const rules = identifierRules();

describe("detectIdentifierType", () => {
  it.each([
    ["MZK01-001277001", "catalogId"],
    ["cnb001388120", "nbn"],
    ["978-80-7325-456-8", "isbn"],
    ["1801-1233", "issn"],
    ["MZK-2801-000341", "barcode"],
    ["Slovácké noviny", null],
  ] as const)("reads %s as %s", (value, expected) => {
    expect(detectIdentifierType(rules, value)).toBe(expected);
  });

  it("never takes a value for a shelf mark, which has no common format (DOC-identifiers)", () => {
    expect(detectIdentifierType(rules, "ST1-0412")).toBeNull();
  });

  it("takes a value only when its checksum holds", () => {
    expect(detectIdentifierType(rules, "978-80-7325-456-3")).toBeNull();
    expect(detectIdentifierType(rules, "1801-1234")).toBeNull();
  });

  it("leaves a value unread when several instances recognise it", () => {
    const first: IdentifierTypeRule = {
      type: "shelfMark",
      labels: { en: "Shelf mark", cs: "Signatura" },
      recogniser: { pattern: ".+", normalisation: [], checksum: null },
    };

    expect(detectIdentifierType([first, ...rules], "MZK01-001277001")).toBeNull();
  });

  it("reads a type checked only by plugin code as any value, for the lookup to check", () => {
    const pluginChecked: IdentifierTypeRule[] = [
      { type: "shelfMark", labels: { en: "Shelf mark", cs: "Signatura" }, recogniser: null },
    ];

    expect(isIdentifierOf(pluginChecked, "shelfMark", "II 12.345")).toBe(true);
    expect(detectIdentifierType(pluginChecked, "II 12.345")).toBeNull();
  });
});

describe("the checksums", () => {
  it.each([
    ["isbn10", "80-7325-456-8", false],
    ["isbn10", "0-306-40615-2", true],
    ["isbn13", "9780306406157", true],
    ["issn", "0317-8471", true],
    ["issn", "2434-561X", true],
  ] as const)("%s over %s is %s", (checksum, value, expected) => {
    expect(recognises({ pattern: "[\\dX-]+", normalisation: [], checksum }, value)).toBe(expected);
  });
});

describe("parseProposalLines", () => {
  it("detects a line when exactly one enabled Identifier instance recognises it", () => {
    expect(parseProposalLines("MZK01-001277001", null, rules)[0]?.type).toBe("catalogId");
  });

  it("leaves a line unread when several instances recognise it", () => {
    const overlapping = [
      ...rules,
      {
        type: "shelfMark" as const,
        labels: { en: "Shelf mark", cs: "Signatura" },
        recogniser: { pattern: "MZK01-001277001", normalisation: [], checksum: null },
      },
    ];

    expect(parseProposalLines("MZK01-001277001", null, overlapping)[0]?.type).toBeNull();
  });

  it("leaves a line unread when no enabled Identifier instance recognises it", () => {
    expect(parseProposalLines("Slovácké noviny", null, rules)[0]?.type).toBeNull();
  });

  it("reads identifier, volume and why, and skips blanks and comments", () => {
    const lines = parseProposalLines(
      "# from the seminar\nMZK01-001622010;1889;For the 1889 elections\n\ncnb001388120\n",
      null,
      rules,
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
    const [line] = parseProposalLines("MZK01-001277001,1940,Seminar", null, rules);

    expect(line).toEqual({
      type: "catalogId",
      value: "MZK01-001277001",
      unit: "1940",
      reason: "Seminar",
    });
  });

  it("reads every line as the chosen type, and marks one that is not", () => {
    const lines = parseProposalLines("1801-1233\ncnb001388120", "issn", rules);

    expect(lines.map((line) => line.type)).toEqual(["issn", null]);
  });

  it("reads any value as a shelf mark when that type is chosen (DOC-identifiers)", () => {
    const lines = parseProposalLines("ST1-0412;roč. 3\nII 12.345", "shelfMark", rules);

    expect(lines.map((line) => line.type)).toEqual(["shelfMark", "shelfMark"]);
  });

  it("normalises a value read as a type, as its recogniser says", () => {
    const [isbn, barcode] = parseProposalLines("978-80-7325-456-8\nmzk-2801-000341", null, rules);

    expect(isbn).toMatchObject({ type: "isbn", value: "9788073254568" });
    expect(barcode).toMatchObject({ type: "barcode", value: "MZK-2801-000341" });
  });
});

describe("defaultBatchNameOf", () => {
  it("names a batch by when it came in, in the library's time (ENT-batch)", () => {
    expect(defaultBatchNameOf(new Date("2026-10-15T22:05:00Z"))).toBe("2026-10-16 00:05");
  });
});
