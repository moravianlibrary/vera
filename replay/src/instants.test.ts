import { describe, expect, it } from "bun:test";
import { normalizeInstants } from "./instants";

describe("normalizeInstants", () => {
  it("normalizes UTC instants recursively while preserving dates and ordinary strings", () => {
    const value = {
      instant: "2026-11-06T12:34:56Z",
      date: "2026-11-06",
      text: "2026-11-06T12:34:56 is a local time",
      nested: ["2026-11-06T12:34:56.12Z", { value: "ordinary" }],
    };

    expect(normalizeInstants(value)).toEqual({
      instant: "2026-11-06T12:34:56.000Z",
      date: "2026-11-06",
      text: "2026-11-06T12:34:56 is a local time",
      nested: ["2026-11-06T12:34:56.120Z", { value: "ordinary" }],
    });
  });
});
