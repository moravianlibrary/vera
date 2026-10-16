// Generated once from docs/demos/shared/vera-data.js so the mock API serves the same coherent
// dataset the demos were designed against; edit by hand from here on. The demo's "today" is
// 2026-06-25: list dates and relative observations were resolved against it. Date-only demo
// values became 09:00 UTC.

import type { Category } from "@vera/domain/entities";

export const categories: readonly Category[] = [
  {
    id: "c1",
    name: "Monographs",
    parentId: null,
  },
  {
    id: "c11",
    name: "19th century",
    parentId: "c1",
  },
  {
    id: "c12",
    name: "20th century",
    parentId: "c1",
  },
  {
    id: "c2",
    name: "Periodicals",
    parentId: null,
  },
  {
    id: "c21",
    name: "Regional",
    parentId: "c2",
  },
  {
    id: "c22",
    name: "National",
    parentId: "c2",
  },
  {
    id: "c23",
    name: "Specialist",
    parentId: "c2",
  },
  {
    id: "c3",
    name: "Manuscripts",
    parentId: null,
  },
  {
    id: "c31",
    name: "Medieval",
    parentId: "c3",
  },
  {
    id: "c32",
    name: "Early modern",
    parentId: "c3",
  },
  {
    id: "c4",
    name: "Maps",
    parentId: null,
  },
];
