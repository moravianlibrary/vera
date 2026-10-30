// Runs and schedules, from docs/demos/shared/vera-data.js `tasks`, `schedules` and
// `taskRetention`, dated around the demo's moment (mocks/today.ts, 2026-06-25 10:40) in the
// library's own time. A run still going holds its pace instead of a count, so the mock works out
// how far it is at any moment, and when it finishes. The curator's re-check (T-9915) is theirs
// here, not Jana's as in the demo, so a curator sees one run of their own going.

import type { Place, Retention, RunTrigger } from "@vera/contract/tasks";
import type { Cadence, Overlap } from "@vera/domain/schedules";

export interface StoredRunError {
  readonly iterationId: string;
  readonly message: string;
  // The item it was found on, so a running run shows only the errors so far.
  readonly atItem: number;
}

// How a run ended; a run with none is still going.
export interface RunEnding {
  readonly state: "Done" | "Failed" | "Cancelled" | "Skipped";
  readonly finishedAt: Date;
  readonly doneCount: number;
}

export interface StoredRun {
  readonly id: string;
  readonly what: string;
  readonly instanceId: string | null;
  // A core job's name, when no plugin ran.
  readonly coreName: string | null;
  readonly trigger: RunTrigger;
  readonly startedBy: string | null;
  readonly startedAt: Date;
  readonly itemCount: number;
  // While it runs: it finishes once every item is done.
  readonly itemsPerMinute: number | null;
  readonly ending: RunEnding | null;
  readonly errors: readonly StoredRunError[];
  // What it changes, shown once it has finished.
  readonly changes: readonly Place[];
  readonly failure: string | null;
  readonly note: string | null;
  readonly cancelledBy: string | null;
  readonly rerunOf: string | null;
}

export interface StoredSchedule {
  readonly id: string;
  readonly instanceId: string;
  readonly name: string;
  readonly cadence: Cadence;
  readonly overlap: Overlap;
  readonly pause: {
    readonly pausedBy: string;
    readonly pausedAt: Date;
    readonly reason: string;
  } | null;
  readonly createdBy: string;
  readonly since: string;
}

// June 2026, in the library's own time.
function june(day: number, hours: number, minutes: number, seconds = 0): Date {
  return new Date(2026, 5, day, hours, minutes, seconds);
}

const every15Minutes = { every: "minutes", interval: 15 } as const;

export const schedules: readonly StoredSchedule[] = [
  {
    id: "s1",
    instanceId: "pi1",
    name: "MZK Aleph — catalog resync",
    cadence: every15Minutes,
    overlap: "skip",
    pause: null,
    createdBy: "u3",
    since: "2026-01-15",
  },
  {
    id: "s6",
    instanceId: "pi2",
    name: "NKP Aleph — catalog resync",
    cadence: every15Minutes,
    overlap: "skip",
    pause: null,
    createdBy: "u3",
    since: "2026-01-15",
  },
  {
    id: "s7",
    instanceId: "pi3",
    name: "VKOL Aleph — catalog resync",
    cadence: every15Minutes,
    overlap: "skip",
    pause: {
      pausedBy: "u3",
      pausedAt: june(18, 9, 12),
      reason: "VKOL is migrating its catalog until 1 July.",
    },
    createdBy: "u3",
    since: "2026-02-20",
  },
  {
    id: "s2",
    instanceId: "pi4",
    name: "Kramerius — registry refresh",
    cadence: { every: "minutes", interval: 30 },
    overlap: "skip",
    pause: null,
    createdBy: "u3",
    since: "2026-01-15",
  },
  {
    id: "s3",
    instanceId: "pi5",
    name: "RDCZ — registry refresh",
    cadence: { every: "hours", interval: 6 },
    overlap: "skip",
    pause: null,
    createdBy: "u3",
    since: "2026-01-15",
  },
  {
    id: "s4",
    instanceId: "pi9",
    name: "Catalog validity — nightly sweep",
    cadence: { every: "day", at: "02:00" },
    overlap: "wait",
    pause: null,
    createdBy: "u3",
    since: "2026-01-15",
  },
  {
    id: "s5",
    instanceId: "pi8",
    name: "ISSN harvest — weekly",
    cadence: { every: "week", weekday: 1, at: "06:00" },
    overlap: "skip",
    pause: null,
    createdBy: "u2",
    since: "2026-04-11",
  },
];

const cadenceOf = (scheduleId: string): Cadence => {
  const schedule = schedules.find((candidate) => candidate.id === scheduleId);
  if (schedule === undefined) {
    throw new Error(`Run fixture names unknown schedule "${scheduleId}"`);
  }

  return schedule.cadence;
};

const onSchedule = (scheduleId: string): RunTrigger => ({
  kind: "schedule",
  scheduleId,
  cadence: cadenceOf(scheduleId),
});

const notEnded = {
  ending: null,
  failure: null,
  note: null,
  cancelledBy: null,
  rerunOf: null,
} as const;

const settled = {
  itemsPerMinute: null,
  failure: null,
  note: null,
  cancelledBy: null,
  rerunOf: null,
};

const historicalSources = [
  { scheduleId: "s1", instanceId: "pi1", what: "MZK Aleph — catalog resync" },
  { scheduleId: "s2", instanceId: "pi4", what: "Kramerius — registry refresh" },
  { scheduleId: "s3", instanceId: "pi5", what: "RDCZ — registry refresh" },
  { scheduleId: "s4", instanceId: "pi9", what: "Catalog validity — nightly sweep" },
] as const;

// Enough retained history to exercise long scrolling and incremental rendering on Tasks. Tests
// set it apart from the runs written by hand.
export const historicalRuns: readonly StoredRun[] = Array.from({ length: 80 }, (_, index) => {
  const source = historicalSources[
    index % historicalSources.length
  ] as (typeof historicalSources)[number];
  const startedAt = june(24 - Math.floor(index / 2), index % 2 === 0 ? 9 : 15, 0);
  const skipped = index > 14 && index % 19 === 0;
  const failed = index > 14 && index % 23 === 0;
  const state = skipped ? "Skipped" : failed ? "Failed" : "Done";
  const doneCount = state === "Done" ? 120 + (index % 5) * 24 : 0;
  return {
    ...settled,
    id: `T-${9700 - index}`,
    what: source.what,
    instanceId: source.instanceId,
    coreName: null,
    trigger: onSchedule(source.scheduleId),
    startedBy: null,
    startedAt,
    itemCount: state === "Done" ? doneCount : state === "Skipped" ? 0 : 240,
    ending: {
      state,
      finishedAt: new Date(startedAt.getTime() + (state === "Skipped" ? 0 : 3 * 60_000)),
      doneCount,
    },
    errors: [],
    changes:
      state === "Done" ? [{ label: `${doneCount} records refreshed`, path: "/documents" }] : [],
    failure: state === "Failed" ? "The source did not answer after three attempts." : null,
    note: state === "Skipped" ? "The previous run was still going." : null,
  };
});

export const runs: readonly StoredRun[] = [
  {
    ...notEnded,
    id: "T-9916",
    what: "Kramerius — registry refresh",
    instanceId: "pi4",
    coreName: null,
    trigger: onSchedule("s2"),
    startedBy: null,
    startedAt: june(25, 10, 38),
    itemCount: 1204,
    itemsPerMinute: 44,
    errors: [],
    changes: [{ label: "2 registry states", path: "/documents" }],
  },
  {
    ...notEnded,
    id: "T-9915",
    what: "Re-check — 12 documents in Periodicals",
    instanceId: "pi9",
    coreName: null,
    trigger: { kind: "manual", from: { label: "Documents", path: "/documents?category=c2" } },
    startedBy: "u8",
    startedAt: june(25, 10, 37),
    itemCount: 12,
    itemsPerMinute: 2.4,
    errors: [
      {
        iterationId: "IT18",
        message: "R07 — publication year not resolvable (260$c “190-?”)",
        atItem: 3,
      },
    ],
    changes: [
      {
        label: "1 document newly failing a rule",
        path: "/review/documents?defect=pi9",
      },
    ],
  },
  {
    ...settled,
    id: "T-9914",
    what: "Kramerius — registry refresh",
    instanceId: "pi4",
    coreName: null,
    trigger: onSchedule("s2"),
    startedBy: null,
    startedAt: june(25, 10, 8),
    itemCount: 0,
    ending: { state: "Skipped", finishedAt: june(25, 10, 8), doneCount: 0 },
    errors: [],
    changes: [],
    note: "The 09:38 run was still going, and this schedule skips an overlapping run.",
  },
  {
    ...settled,
    id: "T-9912",
    what: "MZK Aleph — catalog resync",
    instanceId: "pi1",
    coreName: null,
    trigger: onSchedule("s1"),
    startedBy: null,
    startedAt: june(25, 10, 30),
    itemCount: 214,
    ending: { state: "Done", finishedAt: june(25, 10, 30, 38), doneCount: 214 },
    errors: [],
    changes: [{ label: "3 page counts, 1 title", path: "/documents" }],
  },
  {
    ...settled,
    id: "T-9909",
    what: "RDCZ — registry refresh",
    instanceId: "pi5",
    coreName: null,
    trigger: onSchedule("s3"),
    startedBy: null,
    startedAt: june(25, 6, 0),
    itemCount: 1204,
    ending: { state: "Done", finishedAt: june(25, 6, 4, 12), doneCount: 1204 },
    errors: [],
    changes: [{ label: "1 state — Moravská orlice → Revision", path: "/documents?category=c21" }],
  },
  {
    ...settled,
    id: "T-9905",
    what: "Catalog validity — nightly sweep",
    instanceId: "pi9",
    coreName: null,
    trigger: onSchedule("s4"),
    startedBy: null,
    startedAt: june(25, 2, 0),
    itemCount: 1204,
    ending: { state: "Done", finishedAt: june(25, 2, 21, 40), doneCount: 1204 },
    errors: [
      { iterationId: "IT10", message: "R03 — unbalanced bracket in 245$a", atItem: 212 },
      {
        iterationId: "IT13",
        message: "R07 — publication years not resolvable (260$c “190u-191u”)",
        atItem: 640,
      },
      { iterationId: "IT12", message: "R11 — extent 16 ff., 18 images delivered", atItem: 931 },
    ],
    changes: [
      {
        label: "3 documents newly failing a rule",
        path: "/review/documents?defect=pi9",
      },
    ],
  },
  {
    ...settled,
    id: "T-9893",
    what: "Re-check — 3 maps",
    instanceId: "pi9",
    coreName: null,
    trigger: { kind: "manual", from: { label: "Documents", path: "/documents?category=c4" } },
    startedBy: "u8",
    startedAt: june(23, 9, 12),
    itemCount: 3,
    ending: { state: "Done", finishedAt: june(23, 9, 12, 20), doneCount: 3 },
    errors: [],
    changes: [],
  },
  {
    ...settled,
    id: "T-9901",
    what: "Generate list — Regional catch-up, 4 000 pp",
    instanceId: "pi14",
    coreName: null,
    trigger: { kind: "manual", from: { label: "Digitization Lists", path: "/lists" } },
    startedBy: "u2",
    startedAt: june(22, 14, 5),
    itemCount: 186,
    ending: { state: "Done", finishedAt: june(22, 14, 5, 9), doneCount: 186 },
    errors: [],
    changes: [{ label: "Draft list Regional weeklies", path: "/lists?id=L-2026-015" }],
  },
  {
    ...settled,
    id: "T-9890",
    what: "ISSN harvest — weekly",
    instanceId: "pi8",
    coreName: null,
    trigger: onSchedule("s5"),
    startedBy: null,
    startedAt: june(22, 6, 0),
    itemCount: 50,
    ending: { state: "Done", finishedAt: june(22, 6, 3, 51), doneCount: 50 },
    errors: [],
    changes: [{ label: "2 proposals raised", path: "/requests" }],
  },
  {
    ...settled,
    id: "T-9884",
    what: "Kramerius — full re-harvest",
    instanceId: "pi4",
    coreName: null,
    trigger: { kind: "manual", from: { label: "Plugins", path: "/plugins" } },
    startedBy: "u3",
    startedAt: june(20, 15, 0),
    itemCount: 1204,
    ending: { state: "Cancelled", finishedAt: june(20, 15, 1, 5), doneCount: 112 },
    errors: [],
    changes: [],
    cancelledBy: "u3",
    note: "Stopped after 112 of 1 204; what it had already read stays.",
  },
  {
    ...settled,
    id: "T-9897",
    what: "Ingest batch B-0138 — 1 item",
    instanceId: "pi1",
    coreName: null,
    trigger: { kind: "approval", from: { label: "Requests", path: "/requests" } },
    startedBy: "u1",
    startedAt: june(14, 10, 31),
    itemCount: 1,
    ending: { state: "Failed", finishedAt: june(14, 10, 33, 2), doneCount: 0 },
    errors: [],
    changes: [],
    failure: "Catalog adapter returned HTTP 502 after 3 attempts.",
  },
  {
    ...settled,
    id: "T-9850",
    what: "Monthly output — made June 2026",
    instanceId: null,
    coreName: "Intention repeat",
    trigger: {
      kind: "repeat",
      templateId: "t1",
      name: "Monthly output — {period}",
      cadence: { every: "month", day: 1, at: "00:00" },
    },
    startedBy: null,
    startedAt: june(1, 0, 0),
    itemCount: 1,
    ending: { state: "Done", finishedAt: june(1, 0, 0, 1), doneCount: 1 },
    errors: [],
    changes: [
      { label: "Made Monthly output — June 2026", path: "/intentions?i=i6" },
      { label: "Archived May 2026", path: "/intentions?i=i10" },
    ],
  },
  ...historicalRuns,
];

// Runs 90 days, failed and cancelled ones a year (STATUS "Tasks").
export const retention: Retention = { days: 90, failedDays: 365 };
