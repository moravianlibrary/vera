// The intentions, their mixes and the one repeat, from docs/demos/shared/vera-data.js (i1–i11,
// d1–d2, t1); edit by hand from here on. Overall output selects the House mix; Periodicals push
// is another mix several intentions use (PLAN-mix). Every project has one intention of its own
// without a mix, holding the target the demo gave the project (§3.4, decided 2026-10-07); VISK 7
// backlog became VISK 7 / 2026's. The demo's "today" is 2026-06-25.

import type { Distribution, Intention, IntentionTemplate } from "@/domain/entities";
import { projects } from "@/mocks/fixtures/projects";

const initialDistributions: readonly Distribution[] = [
  {
    id: "d1",
    name: "House mix",
    isPrimary: true,
    archivedAt: null,
    shares: {
      c1: 35,
      c2: 45,
      c3: 15,
      c4: 5,
      c11: 40,
      c12: 60,
      c21: 30,
      c22: 50,
      c23: 20,
      c31: 60,
      c32: 40,
    },
    revision: 4,
    revisions: [],
  },
  {
    id: "d2",
    name: "Periodicals push",
    isPrimary: false,
    archivedAt: null,
    // Maps deliberately excluded; Specialist has no share, so 10% of Periodicals is unallocated.
    shares: {
      c1: 20,
      c2: 70,
      c3: 10,
      c4: 0,
      c11: 50,
      c12: 50,
      c21: 55,
      c22: 35,
      c31: 50,
      c32: 50,
    },
    revision: 2,
    revisions: [],
  },
];

export const distributions: readonly Distribution[] = initialDistributions.map((mix) => ({
  ...mix,
  revisions: [
    {
      revision: mix.revision,
      shares: { ...mix.shares },
      at: "2026-06-25T10:40:00Z",
      label: null,
    },
  ],
}));

const everything = { kind: "any" } as const;

const intentionBase = {
  description: "",
  funding: everything,
  projectId: null,
  scopeCategoryId: null,
  distributionId: "d1",
  targetPages: null,
  endsOn: null,
  isOverall: false,
  templateId: null,
  archived: null,
} as const satisfies Partial<Intention>;

export const intentions: readonly Intention[] = [
  {
    ...intentionBase,
    id: "i4",
    name: "Overall output",
    description: "All digitized work from the reporting baseline.",
    countsFrom: "2019-01-01",
    isOverall: true,
  },
  {
    ...intentionBase,
    id: "i1",
    name: "NDK Periodika — 2026 Q3",
    description: "The quarter of the NDK grant that goes to periodicals.",
    funding: { kind: "project", projectId: "p1" },
    scopeCategoryId: "c2",
    distributionId: "d2",
    targetPages: 7500,
    countsFrom: "2026-07-01",
    endsOn: "2026-09-30",
  },
  {
    ...intentionBase,
    id: "i5",
    name: "Moravica — closing year",
    description: "The extension year of the Moravica grant.",
    funding: { kind: "project", projectId: "p3" },
    targetPages: 800,
    countsFrom: "2026-01-01",
    endsOn: "2026-12-31",
  },
  {
    ...intentionBase,
    id: "i3",
    name: "Regional catch-up",
    description: "Regional weeklies we are behind on. No deadline — done when done.",
    scopeCategoryId: "c21",
    distributionId: "d2",
    targetPages: 4000,
    countsFrom: "2026-03-12",
  },
  {
    ...intentionBase,
    id: "i6",
    name: "Monthly output — June 2026",
    description: "What the scanning room should deliver this month.",
    templateId: "t1",
    targetPages: 3000,
    countsFrom: "2026-06-01",
    endsOn: "2026-06-30",
  },
  {
    ...intentionBase,
    id: "i10",
    name: "Monthly output — May 2026",
    description: "What the scanning room should deliver this month.",
    templateId: "t1",
    targetPages: 3000,
    countsFrom: "2026-05-01",
    endsOn: "2026-05-31",
    archived: { actor: { kind: "system" }, at: "2026-06-01T00:00:00Z" },
  },
  {
    ...intentionBase,
    id: "i7",
    name: "June catch-up run",
    description: "One run, one target: the first three weeks of June.",
    targetPages: 3000,
    countsFrom: "2026-06-01",
    endsOn: "2026-06-19",
  },
  {
    ...intentionBase,
    id: "i8",
    name: "Periodicals push — watch",
    description: "Is what we deliver inside Periodicals shaped the way the push says?",
    scopeCategoryId: "c2",
    distributionId: "d2",
    countsFrom: "2026-01-01",
  },
  {
    ...intentionBase,
    id: "i11",
    name: "Unfunded work — 2027",
    description: "The mix of what we digitize on our own budget next year.",
    funding: { kind: "none" },
    countsFrom: "2027-01-01",
    endsOn: "2027-12-31",
  },
  {
    ...intentionBase,
    id: "i9",
    name: "Maps watch",
    description: "Kept while the large-format scanner was out. Nothing to watch until Q4.",
    scopeCategoryId: "c4",
    countsFrom: "2026-01-01",
    archived: { actor: { kind: "user", userId: "u2" }, at: "2026-06-12T09:00:00Z" },
  },
  projectIntention("i2", "p2", 3000, {
    description: "Clearing the approved backlog the VISK 7 grant pays for.",
  }),
  projectIntention("i12", "p1", 6000),
  projectIntention("i13", "p3", 1200),
  projectIntention("i14", "p4", 2000),
  projectIntention("i15", "p8", 800),
  projectIntention("i16", "p9", 1500, {
    archived: { actor: { kind: "user", userId: "u1" }, at: "2026-03-16T09:00:00Z" },
  }),
  projectIntention("i17", "p5", 2500),
  projectIntention("i18", "p6", 1200),
  projectIntention("i19", "p7", 900),
];

// A project's own intention: its name, funding and window are the project's; a rejected
// project's is archived with it.
function projectIntention(
  id: string,
  projectId: string,
  targetPages: number,
  fields: Partial<Intention> = {},
): Intention {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (project === undefined) {
    throw new Error(`No project ${projectId}`);
  }

  return {
    ...intentionBase,
    id,
    name: project.name,
    funding: { kind: "project", projectId },
    projectId,
    distributionId: null,
    targetPages,
    countsFrom: project.startsOn,
    endsOn: project.endsOn,
    ...fields,
  };
}

export const intentionTemplates: readonly IntentionTemplate[] = [
  {
    id: "t1",
    namePattern: "Monthly output — {period}",
    every: "month",
    funding: everything,
    scopeCategoryId: null,
    distributionId: "d1",
    targetPages: 3000,
    isArchivingPrevious: true,
    since: "2026-05-01",
    nextOn: "2026-07-01",
    createdBy: "u3",
  },
];
