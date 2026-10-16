// How the Projects page arranges the rows the server sends.

import type { ProjectRow } from "@vera/contract/projects";
import type { Project } from "@vera/domain/entities";
import type { ProjectPeriod } from "@vera/domain/projects";
import { describe, expect, it } from "vitest";
import { paceOf, projectNoteOf, projectSectionsOf } from "@/features/projects/projects-view";

const base = {
  name: "P",
  description: "",
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
  createdAt = "2026-01-01T09:00:00Z",
  decidedAt = "2026-01-02T09:00:00Z",
): ProjectRow {
  const decided = { actorId: "u2", at: decidedAt };
  const project: Project =
    state === "Approved"
      ? { ...base, id, startsOn, endsOn, createdAt, state, priority: "Normal", ...decided }
      : state === "Rejected"
        ? { ...base, id, startsOn, endsOn, createdAt, state, reason: "No", ...decided }
        : { ...base, id, startsOn, endsOn, createdAt, state };
  return {
    project,
    intention: { id: `i-${id}`, targetPages: 1000 },
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
  it("sorts each category newest first by creation, start, end or decision date", () => {
    const sections = projectSectionsOf([
      rowOf(
        "proposed-old",
        "Proposed",
        "Upcoming",
        "2026-09-01",
        "2027-01-01",
        "2026-01-01T09:00:00Z",
      ),
      rowOf(
        "rejected-old",
        "Rejected",
        "Upcoming",
        "2026-09-01",
        "2027-01-01",
        undefined,
        "2026-02-01T09:00:00Z",
      ),
      rowOf("active-old", "Approved", "Active", "2025-01-01", "2027-01-01"),
      rowOf("ended-old", "Approved", "Ended", "2023-01-01", "2024-01-01"),
      rowOf(
        "proposed-new",
        "Proposed",
        "Upcoming",
        "2026-09-01",
        "2027-01-01",
        "2026-02-01T09:00:00Z",
      ),
      rowOf(
        "rejected-new",
        "Rejected",
        "Upcoming",
        "2026-09-01",
        "2027-01-01",
        undefined,
        "2026-03-01T09:00:00Z",
      ),
      rowOf("active-new", "Approved", "Active", "2026-01-01", "2027-01-01"),
      rowOf("ended-new", "Approved", "Ended", "2023-01-01", "2025-01-01"),
    ]);
    expect(sections.proposed.map((row) => row.project.id)).toEqual([
      "proposed-new",
      "proposed-old",
    ]);
    expect(sections.active.map((row) => row.project.id)).toEqual(["active-new", "active-old"]);
    expect(sections.ended.map((row) => row.project.id)).toEqual(["ended-new", "ended-old"]);
    expect(sections.rejected.map((row) => row.project.id)).toEqual([
      "rejected-new",
      "rejected-old",
    ]);
  });

  it("places approved upcoming projects with active and lapsed proposed projects with ended", () => {
    const sections = projectSectionsOf([
      rowOf("upcoming", "Approved", "Upcoming", "2026-09-01", "2027-08-31"),
      rowOf("late", "Approved", "Active", "2026-01-01", "2027-12-31"),
      rowOf("soon", "Approved", "Active", "2025-01-01", "2026-12-31"),
      rowOf("proposed", "Proposed", "Upcoming", "2026-10-01", "2027-09-30"),
      rowOf("ended", "Approved", "Ended", "2024-01-01", "2024-12-31"),
      rowOf("lapsed", "Proposed", "Ended", "2024-01-01", "2025-12-31"),
      rowOf("rejected", "Rejected", "Active", "2026-01-01", "2026-12-31"),
    ]);

    expect(sections.proposed.map((row) => row.project.id)).toEqual(["proposed"]);
    expect(sections.active.map((row) => row.project.id)).toEqual(["upcoming", "late", "soon"]);
    expect(sections.ended.map((row) => row.project.id)).toEqual(["lapsed", "ended"]);
    expect(sections.rejected.map((row) => row.project.id)).toEqual(["rejected"]);
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

  it("says a running project with no target has none, its intention tracking the mix", () => {
    const row = rowOf("p", "Approved", "Active", "2026-01-01", "2026-12-31");

    expect(
      projectNoteOf(
        { ...row, intention: { id: "i", targetPages: null }, fundedCount: 2, deliveredPages: 80 },
        "",
      ).title,
    ).toBe("Running since 1 Jan 2026, with no target");
  });
});
