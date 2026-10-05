// Generated once from docs/demos/shared/vera-data.js so the mock API serves the same coherent
// dataset the demos were designed against; edit by hand from here on. The demo's "today" is
// 2026-06-25: list dates and relative observations were resolved against it. Date-only demo
// values became 09:00 UTC.

import type { Batch } from "@/domain/entities";

export const batches: readonly Batch[] = [
  {
    id: "B-0145",
    name: "ISSN sweep, 25 Jun",
    via: "harvest",
    submittedBy: "a2",
    submittedAt: "2026-06-25T06:00:00Z",
  },
  {
    id: "B-0144",
    name: "brno-almanacs.txt",
    via: "pastedList",
    submittedBy: "u5",
    submittedAt: "2026-06-24T16:40:00Z",
  },
  {
    id: "B-0143",
    name: "shelf ST1-04",
    via: "barcodeScan",
    submittedBy: "u4",
    submittedAt: "2026-06-24T10:14:00Z",
  },
  {
    id: "B-0142",
    name: "proposals-2026-06-21.csv",
    via: "file",
    submittedBy: "u3",
    submittedAt: "2026-06-21T09:12:00Z",
  },
  {
    id: "B-0141",
    name: "proposals-2026-06-19.csv",
    via: "file",
    submittedBy: "u3",
    submittedAt: "2026-06-19T08:40:00Z",
  },
  {
    id: "B-0138",
    name: "harvest / ISSN harvester",
    via: "harvest",
    submittedBy: "a2",
    submittedAt: "2026-06-14T06:00:00Z",
  },
  {
    id: "B-0120",
    name: "proposals-2026-04-02.csv",
    via: "file",
    submittedBy: "u3",
    submittedAt: "2026-04-02T10:05:00Z",
  },
];
