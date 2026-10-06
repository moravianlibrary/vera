// How the Projects page arranges the rows the server sends.

import { describe, expect, it } from "vitest";
import type { ProjectRow } from "@/api/projects";
import type { Project } from "@/domain/entities";
import type { ProjectPeriod } from "@/domain/projects";
import { paceOf, projectNoteOf, projectSectionsOf } from "@/features/projects/projects-view";

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
    intentionCount: 0,
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

describe("projectNoteOf", () => {
  it("says what approving a proposed project would do, and what it skips", () => {
    const row = rowOf("p", "Proposed", "Upcoming", "2026-09-01", "2027-08-31");

    expect(projectNoteOf(row, "").body).toBe(
      "Nothing is proposed into it yet; members can propose while it waits.",
    );
    expect(
      projectNoteOf({ ...row, pending: { documentCount: 2, withCopyCount: 1 } }, "").body,
    ).toBe(
      "2 documents are proposed into it. Approving approves them at the priority it picks, except 1 with a copy, each decided on its own as a rescan.",
    );
  });

  it("puts the pace in words while it runs: what is on lists and what waits for one", () => {
    const row = rowOf("p", "Approved", "Active", "2026-01-01", "2026-12-31");
    const note = projectNoteOf(
      {
        ...row,
        verdict: "behindPace",
        timeElapsed: 0.5,
        daysLeft: 190,
        fundedCount: 4,
        plannedPages: 300,
        deliveredPages: 100,
        waiting: { itemCount: 2, pages: 940 },
      },
      "Jana",
    );

    expect(note).toEqual({
      tone: "amber",
      title: "Behind pace — 10% delivered with 50% of the time gone",
      body: "190 days left. 200 pp are on lists and not digitized yet. 940 pp more are approved and waiting for a list.",
    });
  });
});
