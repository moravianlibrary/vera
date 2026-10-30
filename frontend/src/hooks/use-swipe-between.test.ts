// The thresholds and list edges that decide whether a phone gesture changes records.

import { describe, expect, it } from "vitest";
import {
  hasNeighbour,
  isEdgeZone,
  isNearEnd,
  swipeCommits,
  swipeDirection,
} from "@/hooks/use-swipe-between";

describe("phone record swipe logic", () => {
  it("waits for 12 horizontal pixels", () => expect(swipeDirection(11, 0)).toBeNull());
  it("leaves vertical movement to scrolling", () => expect(swipeDirection(30, 25)).toBeNull());
  it("commits after 30 percent of the element", () =>
    expect(swipeCommits(90, 300, 500)).toBe(true));
  it("commits a fast flick", () => expect(swipeCommits(48, 300, 80)).toBe(true));
  it("rejects starts in either edge zone", () => {
    expect(isEdgeZone(20, 393)).toBe(true);
    expect(isEdgeZone(373, 393)).toBe(true);
    expect(isEdgeZone(30, 393)).toBe(false);
  });
  it("has no direction when the caller has no neighbour", () => {
    expect(hasNeighbour("previous", 0, 4)).toBe(false);
    expect(hasNeighbour("next", 3, 4)).toBe(false);
    expect(hasNeighbour("next", 0, 4)).toBe(true);
  });
  it("identifies the final three loaded rows for near-end loading", () => {
    expect(isNearEnd(2, 5)).toBe(true);
    expect(isNearEnd(1, 5)).toBe(false);
  });
});
