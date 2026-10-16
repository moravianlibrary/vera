// What a watchlist's push says and when its batch goes (WATCH-push).

import { describe, expect, it } from "bun:test";
import { isPushDue, pushNoticeOf } from "./watchlist-push";

describe("pushNoticeOf", () => {
  it("names the watchlist and the first three records, the rest as a count", () => {
    expect(pushNoticeOf("Periodicals", ["A", "B"])).toEqual({ title: "Periodicals", body: "A, B" });
    expect(pushNoticeOf("Periodicals", ["A", "B", "C", "D", "E"]).body).toBe("A, B, C +2 more");
  });
});

describe("isPushDue", () => {
  const at = (seconds: number) => new Date(2026, 5, 25, 10, 40, seconds);

  it("waits while records keep entering, and sends after five quiet seconds", () => {
    expect(isPushDue([at(0), at(3)], at(6))).toBe(false);
    expect(isPushDue([at(0), at(3)], at(8))).toBe(true);
  });

  it("sends thirty seconds after the first record even while more keep entering", () => {
    expect(isPushDue([at(0), at(26), at(29)], at(30))).toBe(true);
  });

  it("has nothing to send without records", () => {
    expect(isPushDue([], at(50))).toBe(false);
  });
});
