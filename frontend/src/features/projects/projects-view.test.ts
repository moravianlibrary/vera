// How the Projects page arranges the rows the server sends.

import { describe, expect, it } from "vitest";
import type { ProjectRow } from "@/api/projects";
import type { Project } from "@/domain/entities";
import type { ProjectPeriod } from "@/domain/projects";
import { paceOf, projectSectionsOf } from "@/features/projects/projects-view";

const base = {
  name: "P",
  description: "",
  targetPages: 1000,
  managerId: "u1",
  memberIds: ["u1"],
  memberGroupIds: [],
  createdAt: "2026-01-01T09:00:00Z",
};

function rowOf(
  id: string,
  state: Project["state"],
  period: ProjectPeriod,
  startsOn: string,
  endsOn: string,
): ProjectRow {
  const decided = { actorId: "u2", at: "2026-01-02T09:00:00Z" };
  const project: Project =
    state === "Approved"
      ? { ...base, id, startsOn, endsOn, state, priority: "Normal", ...decided }
      : state === "Rejected"
        ? { ...base, id, startsOn, endsOn, state, reason: "No", ...decided }
        : { ...base, id, startsOn, endsOn, state };
  return {
    project,
    period,
    timeElapsed: 0,
    daysToStart: 0,
    daysLeft: 0,
    evenPace: null,
    verdict: null,
    fundedCount: 0,
    plannedPages: 0,
    deliveredPages: 0,
    waiting: { itemCount: 0, pages: 0 },
    pending: { documentCount: 0, withCopyCount: 0 },
    proposalCount: 0,
    listCount: 0,
    memberGroups: [],
  };
}

describe("projectSectionsOf", () => {
  it("puts the proposed first, then the running by end, then the coming by start", () => {
    const sections = projectSectionsOf([
      rowOf("upcoming", "Approved", "Upcoming", "2026-09-01", "2027-08-31"),
      rowOf("late", "Approved", "Active", "2026-01-01", "2027-12-31"),
      rowOf("soon", "Approved", "Active", "2025-01-01", "2026-12-31"),
      rowOf("proposed", "Proposed", "Upcoming", "2026-10-01", "2027-09-30"),
      rowOf("ended", "Approved", "Ended", "2024-01-01", "2024-12-31"),
      rowOf("lapsed", "Proposed", "Ended", "2024-01-01", "2025-12-31"),
      rowOf("rejected", "Rejected", "Active", "2026-01-01", "2026-12-31"),
    ]);

    expect(sections.cards.map((row) => row.project.id)).toEqual([
      "proposed",
      "soon",
      "late",
      "upcoming",
    ]);
    expect(sections.ended.map((row) => row.project.id)).toEqual(["lapsed", "ended"]);
    expect(sections.rejected.map((row) => row.project.id)).toEqual(["rejected"]);
    expect(sections.counts).toEqual({ proposed: 1, active: 2, upcoming: 1, ended: 2 });
  });
});

describe("paceOf", () => {
  it("says how much an ended project delivered when it fell short", () => {
    const row = rowOf("ended", "Approved", "Ended", "2024-01-01", "2024-12-31");

    expect(paceOf({ ...row, verdict: "short", deliveredPages: 455 })).toEqual({
      text: "46% delivered",
      tone: "amber",
    });
    expect(paceOf(row)).toBeNull();
  });
});
