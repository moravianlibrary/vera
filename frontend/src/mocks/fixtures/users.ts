// Generated once from docs/demos/shared/vera-data.js so the mock API serves the same coherent
// dataset the demos were designed against; edit by hand from here on. The demo's "today" is
// 2026-06-25: list dates and relative observations were resolved against it. Date-only demo
// values became 09:00 UTC.

import type { User } from "@/domain/entities";

export const users: readonly User[] = [
  {
    id: "u1",
    name: "Jana Nováková",
    kind: "person",
    email: "jana.novakova@mzk.cz",
  },
  {
    id: "u2",
    name: "Martin Svoboda",
    kind: "person",
    email: "martin.svoboda@mzk.cz",
  },
  {
    id: "u3",
    name: "Petr Dvořák",
    kind: "person",
    email: "petr.dvorak@mzk.cz",
  },
  {
    id: "u4",
    name: "Eva Horáková",
    kind: "person",
    email: "eva.horakova@mzk.cz",
  },
  {
    id: "u8",
    name: "Kateřina Novotná",
    kind: "person",
    email: "katerina.novotna@mzk.cz",
  },
  {
    id: "u9",
    name: "Radek Šimek",
    kind: "person",
    email: "radek.simek@mzk.cz",
  },
  {
    id: "u5",
    name: "Tomáš Marek",
    kind: "person",
    email: "tomas.marek@muni.cz",
  },
  {
    id: "u6",
    name: "Lucie Benešová",
    kind: "person",
    email: "lucie.benesova@gmail.com",
  },
  {
    id: "u7",
    name: "Ondřej Krejčí",
    kind: "person",
    email: "ondrej.krejci@seznam.cz",
  },
  {
    id: "u10",
    name: "Adam Kolář",
    kind: "person",
    email: "adam.kolar@post.cz",
  },
  {
    id: "a1",
    name: "Kramerius sweep",
    kind: "agent",
    email: null,
  },
  {
    id: "a2",
    name: "ISSN harvester",
    kind: "agent",
    email: null,
  },
  // MZK Kramerius publications' agent: what it sets is logged as it (PLG-kinds).
  {
    id: "a3",
    name: "Publication detector",
    kind: "agent",
    email: null,
  },
];
