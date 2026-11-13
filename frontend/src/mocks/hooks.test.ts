// Incoming public events obey subscription conditions and recipient batching.

import { describe, expect, it } from "vitest";
import { database } from "@/mocks/database";
import { recordHookEvent } from "@/mocks/hooks";

describe("hook event collection", () => {
  it("delivers each subscribed code to an unbatched multi-code hook", () => {
    const template = database.hooks[0];
    if (template === undefined) throw new Error("Missing hook fixture");
    const hookId = "test-multi-code-hook";
    database.hooks.push({
      ...template,
      id: hookId,
      events: ["request.held", "iteration.ingested"],
      conditions: {},
      batch: null,
    });

    recordHookEvent("request.held", "R-held", "", "Held");
    recordHookEvent("iteration.ingested", "IT-ingested", "", "Ingested");

    expect(
      database.hookDeliveries
        .filter((delivery) => delivery.hookId === hookId)
        .map((delivery) => delivery.events),
    ).toEqual([["request.held"], ["iteration.ingested"]]);
    database.hooks = database.hooks.filter((hook) => hook.id !== hookId);
    database.hookDeliveries = database.hookDeliveries.filter(
      (delivery) => delivery.hookId !== hookId,
    );
  });

  it("matches a Documents category subtree using the subject, without caller access", () => {
    const template = database.hooks[0];
    const inside = database.iterations.find((iteration) => iteration.categoryId === "c21");
    const outside = database.iterations.find((iteration) => iteration.categoryId === "c11");
    if (!template || !inside || !outside) throw new Error("Missing category fixtures");
    const hook = {
      ...template,
      id: "condition-test",
      events: ["iteration.published" as const],
      conditions: { documents: { category: "c2" } },
      batch: null,
    };
    database.hooks.push(hook);
    try {
      recordHookEvent("iteration.published", inside.id, "", "Inside");
      recordHookEvent("iteration.published", outside.id, "", "Outside");
      expect(
        database.hookDeliveries
          .filter((delivery) => delivery.hookId === hook.id)
          .map((delivery) => delivery.subjects),
      ).toEqual([[inside.id]]);
    } finally {
      database.hooks = database.hooks.filter((candidate) => candidate.id !== hook.id);
      database.hookDeliveries = database.hookDeliveries.filter(
        (delivery) => delivery.hookId !== hook.id,
      );
    }
  });

  it("groups a requester's subscribed events and caps the wait", () => {
    const before = database.hookDeliveries.length;
    const first = new Date("2026-06-25T11:00:00Z");
    recordHookEvent(
      "request.approved",
      "R-new-1",
      "reader@example.org",
      "The request was approved",
      first,
    );
    recordHookEvent(
      "request.declined",
      "R-new-2",
      "reader@example.org",
      "The request was denied",
      new Date("2026-06-25T11:50:00Z"),
    );
    recordHookEvent(
      "request.held",
      "R-new-3",
      "reader@example.org",
      "The request was withdrawn",
      new Date("2026-06-25T11:51:00Z"),
    );

    const added = database.hookDeliveries.slice(before);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      hookId: "H-02",
      subjects: ["R-new-1", "R-new-2"],
      events: ["request.approved", "request.declined"],
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
