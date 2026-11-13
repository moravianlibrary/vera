// Generated once from docs/demos/shared/vera-data.js so the mock API serves the same coherent
// dataset the demos were designed against; edit by hand from here on. The demo's "today" is
// 2026-06-25: list dates and relative observations were resolved against it. Date-only demo
// values became 09:00 UTC.

import type { Category } from "@vera/domain/entities";

export const categories: readonly Category[] = [
  {
    id: "c1",
    name: "Monographs",
    names: { en: "Monographs", cs: "Monografie" },
    parentId: null,
  },
  {
    id: "c11",
    name: "19th century",
    names: { en: "19th century", cs: "19. století" },
    parentId: "c1",
  },
  {
    id: "c12",
    name: "20th century",
    names: { en: "20th century", cs: "20. století" },
    parentId: "c1",
  },
  {
    id: "c2",
    name: "Periodicals",
    names: { en: "Periodicals", cs: "Periodika" },
    parentId: null,
  },
  {
    id: "c21",
    name: "Regional",
    names: { en: "Regional", cs: "Regionální" },
    parentId: "c2",
  },
  {
    id: "c22",
    name: "National",
    names: { en: "National", cs: "Národní" },
    parentId: "c2",
  },
  {
    id: "c23",
    name: "Specialist",
    names: { en: "Specialist", cs: "Odborné" },
    parentId: "c2",
  },
  {
    id: "c3",
    name: "Manuscripts",
    names: { en: "Manuscripts", cs: "Rukopisy" },
    parentId: null,
  },
  {
    id: "c31",
    name: "Medieval",
    names: { en: "Medieval", cs: "Středověké" },
    parentId: "c3",
  },
  {
    id: "c32",
    name: "Early modern",
    names: { en: "Early modern", cs: "Raně novověké" },
    parentId: "c3",
  },
  {
    id: "c4",
    name: "Maps",
    names: { en: "Maps", cs: "Mapy" },
    parentId: null,
  },
];
