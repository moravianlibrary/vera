// Generated once from docs/demos/shared/vera-data.js so the mock API serves the same coherent
// dataset the demos were designed against; edit by hand from here on. The demo's "today" is
// 2026-06-25: list dates and relative observations were resolved against it. Date-only demo
// values became 09:00 UTC.

import type { DigitizationList } from "@/domain/entities";

export const lists: readonly DigitizationList[] = [
  {
    id: "L-2026-014",
    name: "Periodika — summer run",
    startsOn: "2026-06-22",
    endsOn: "2026-07-10",
    targetPages: 3500,
    generated: null,
    createdBy: "u2",
    createdAt: "2026-06-15T09:00:00Z",
    done: null,
  },
  {
    id: "L-2026-015",
    name: "Regional weeklies",
    startsOn: "2026-10-05",
    endsOn: "2026-10-23",
    targetPages: 4000,
    generated: {
      intentionId: "i3",
      mixRevision: 2,
      pages: 4000,
      allocation: null,
      generator: "PriorityFirst 1.2.0",
      at: "2026-06-22T09:00:00Z",
    },
    createdBy: "u2",
    createdAt: "2026-06-22T09:00:00Z",
    done: null,
  },
  {
    id: "L-2026-016",
    name: "Manuscripts — November",
    startsOn: "2026-11-02",
    endsOn: "2026-11-20",
    targetPages: null,
    generated: null,
    createdBy: "u2",
    createdAt: "2026-06-24T09:00:00Z",
    done: null,
  },
  {
    id: "L-2026-012",
    name: "Moravica — June",
    startsOn: "2026-06-01",
    endsOn: "2026-06-19",
    targetPages: 3000,
    generated: null,
    createdBy: "u2",
    createdAt: "2026-05-20T09:00:00Z",
    done: {
      actorId: "u2",
      at: "2026-06-20T09:00:00Z",
    },
  },
];
