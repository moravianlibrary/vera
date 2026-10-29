import { describe, expect, it } from "bun:test";
import { isSameMixQuery, parseMixSearchParams, toMixSearchParams } from "./mix-filters";

describe("Category mixes filter URLs", () => {
  it("normalizes equivalent saved filters and ignores invalid ranges", () => {
    const first = parseMixSearchParams(
      new URLSearchParams(
        "state=Archived,Active&primary=Primary&proportions=Unallocated&intentions=1..",
      ),
    );
    const second = parseMixSearchParams(
      new URLSearchParams(
        "intentions=1..&proportions=Unallocated&primary=Primary&state=Active,Archived",
      ),
    );
    expect(isSameMixQuery(first, second)).toBe(true);
    expect(toMixSearchParams(first).get("intentions")).toBe("1..");
    expect(parseMixSearchParams(new URLSearchParams("intentions=bad&state=Unknown"))).toEqual({
      search: undefined,
      states: undefined,
      primaries: undefined,
      proportions: undefined,
      intentions: undefined,
    });
  });
});
