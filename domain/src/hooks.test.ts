// Quiet-period and retry timing cannot drift between server and UI previews.

import { describe, expect, it } from "bun:test";
import { retryAtOf, sendAtOf } from "./hooks";

describe("hook timing", () => {
  it("restarts the quiet wait, bounded by the first event's deadline", () => {
    const first = new Date("2026-06-25T10:00:00Z");
    expect(
      sendAtOf(first, new Date("2026-06-25T10:10:00Z"), {
        waitMinutes: 15,
        maxMinutes: 60,
        by: "recipient",
      }).toISOString(),
    ).toBe("2026-06-25T10:25:00.000Z");
    expect(
      sendAtOf(first, new Date("2026-06-25T10:55:00Z"), {
        waitMinutes: 15,
        maxMinutes: 60,
        by: "recipient",
      }).toISOString(),
    ).toBe("2026-06-25T11:00:00.000Z");
  });

  it("stops after the configured attempts", () => {
    const failed = new Date("2026-06-25T10:00:00Z");
    expect(retryAtOf(failed, 1, { attempts: 3, backoff: "fixed" })?.toISOString()).toBe(
      "2026-06-25T10:05:00.000Z",
    );
    expect(retryAtOf(failed, 2, { attempts: 3, backoff: "exponential" })?.toISOString()).toBe(
      "2026-06-25T10:02:00.000Z",
    );
    expect(retryAtOf(failed, 3, { attempts: 3, backoff: "exponential" })).toBeNull();
  });
});
