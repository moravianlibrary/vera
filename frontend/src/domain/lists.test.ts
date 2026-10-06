// A list's state from its dates, and what blocks a member after it was listed.

import { describe, expect, it } from "vitest";
import type { DigitizationList } from "@/domain/entities";
import { isOverdue, listStateOf, memberBlockerOf, progressOnList } from "@/domain/lists";
import { iterations } from "@/mocks/fixtures/iterations";
import { lists } from "@/mocks/fixtures/lists";

const running = lists.find((list) => list.id === "L-2026-014") as DigitizationList;

describe("listStateOf", () => {
  it("is Planned before the start, In progress from that day, Done only once marked", () => {
    expect(listStateOf(running, "2026-06-21")).toBe("Planned");
    expect(listStateOf(running, "2026-06-22")).toBe("InProgress");
    expect(listStateOf(running, "2026-08-01")).toBe("InProgress");
    expect(
      listStateOf(
        { ...running, done: { actorId: "u2", at: "2026-07-11T09:00:00Z" } },
        "2026-06-01",
      ),
    ).toBe("Done");
  });

  it("gives members the progress the start says", () => {
    expect(progressOnList(running, "2026-06-21")).toBe("Planned");
    expect(progressOnList(running, "2026-06-25")).toBe("InProgress");
  });
});

describe("isOverdue", () => {
  it("is past the end and not marked Done", () => {
    expect(isOverdue(running, "2026-07-10")).toBe(false);
    expect(isOverdue(running, "2026-07-11")).toBe(true);
  });
});

describe("memberBlockerOf", () => {
  it("names a gate that fails after listing, never a scan or a clean member", () => {
    const blockerOf = (id: string) => {
      const iteration = iterations.find((candidate) => candidate.id === id);
      return iteration === undefined ? undefined : memberBlockerOf(iteration);
    };
    expect(blockerOf("IT25")).toBe("ReviewNeeded");
    expect(blockerOf("IT24")).toBeNull();
    expect(blockerOf("IT12")).toBeNull();
  });
});
