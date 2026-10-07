// Incoming public events obey subscription conditions and recipient batching.

import { describe, expect, it } from "vitest";
import { database } from "@/mocks/database";
import { recordHookEvent } from "@/mocks/hooks";

describe("hook event collection", () => {
  it("groups a requester's decisions, caps the wait and excludes other decisions", () => {
    const before = database.hookDeliveries.length;
    const first = new Date("2026-06-25T11:00:00Z");
    recordHookEvent(
      "request.decided",
      "R-new-1",
      "reader@example.org",
      "The request was approved",
      { decision: "Approved" },
      first,
    );
    recordHookEvent(
      "request.decided",
      "R-new-2",
      "reader@example.org",
      "The request was denied",
      { decision: "Denied" },
      new Date("2026-06-25T11:50:00Z"),
    );
    recordHookEvent(
      "request.decided",
      "R-new-3",
      "reader@example.org",
      "The request was withdrawn",
      { decision: "Other" },
      new Date("2026-06-25T11:51:00Z"),
    );

    const added = database.hookDeliveries.slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      hookId: "H-02",
      subjects: ["R-new-1", "R-new-2"],
      state: "waiting",
      sendAt: "2026-06-25T12:00:00.000Z",
    });
  });

  it("ignores events while a hook is paused", () => {
    const before = database.hookDeliveries.length;
    recordHookEvent("list.created", "L-new", "/incoming", "A new list");
    expect(
      database.hookDeliveries.slice(before).some((delivery) => delivery.hookId === "H-04"),
    ).toBe(false);
  });
});
