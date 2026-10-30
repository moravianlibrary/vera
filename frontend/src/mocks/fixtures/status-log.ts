// The demo’s log converted to event codes; data is retained with each cause.
import type { EventEntry } from "@vera/domain/events";

export const statusLog: readonly EventEntry[] = [
  {
    id: "E01",
    subjectKind: "iteration",
    subjectId: "IT3",
    at: "2026-06-20T14:02:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k1",
    reason: {
      public: null,
      internal: "accepted, 22-page difference is not material.",
    },
    code: "iteration.verdict_accepted",
    data: {
      defects: [
        {
          instance: {
            id: "pi1",
            name: "MZK Aleph",
          },
          rule: "R02",
        },
      ],
    },
  },
  {
    id: "E02",
    subjectKind: "iteration",
    subjectId: "IT3",
    at: "2026-06-19T09:14:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "k2",
    reason: {
      public: null,
      internal: null,
    },
    code: "iteration.page_count_entered",
    data: {
      pages: 1120,
      previous: 1098,
    },
  },
  {
    id: "E108",
    subjectKind: "request",
    subjectId: "R3",
    at: "2026-06-17T16:40:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k3",
    reason: {
      public: null,
      internal: "Category Periodicals / Regional, priority Urgent.",
    },
    code: "request.approved",
    data: {
      iterationId: "IT3",
      isRescan: false,
      batchSize: 3,
    },
  },
  {
    id: "E109",
    subjectKind: "request",
    subjectId: "R14",
    at: "2026-06-17T16:40:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k3",
    reason: {
      public: null,
      internal: "Category Periodicals / Regional, priority Urgent.",
    },
    code: "request.approved",
    data: {
      iterationId: "IT3",
      isRescan: false,
      batchSize: 3,
    },
  },
  {
    id: "E110",
    subjectKind: "request",
    subjectId: "R15",
    at: "2026-06-17T16:40:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k3",
    reason: {
      public: null,
      internal: "Category Periodicals / Regional, priority Urgent.",
    },
    code: "request.approved",
    data: {
      iterationId: "IT3",
      isRescan: false,
      batchSize: 3,
    },
  },
  {
    id: "E04",
    subjectKind: "iteration",
    subjectId: "IT14",
    at: "2026-06-21T06:04:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k15",
    reason: {
      public: null,
      internal: "editor-in-chief died 1961, protected until 2031.",
    },
    code: "iteration.restricted",
    data: {
      rule: {
        id: "copyright",
        name: "Copyright",
      },
      outcome: "forbidden",
    },
  },
  {
    id: "E111",
    subjectKind: "request",
    subjectId: "R8",
    at: "2026-06-19T11:20:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k4",
    reason: {
      public: null,
      internal:
        "Over VERA 2019 and Kramerius: published. 300 dpi greyscale is not enough for the regional project.",
    },
    code: "request.approved",
    data: {
      iterationId: "IT8",
      isRescan: true,
      batchSize: 1,
    },
  },
  {
    id: "E06",
    subjectKind: "iteration",
    subjectId: "IT0",
    at: "2019-11-14T09:30:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k0",
    reason: {
      public: null,
      internal: null,
    },
    code: "iteration.published",
    data: {
      link: {
        id: "IT0-L1",
        url: "https://kramerius.mzk.cz/view/uuid:demo8",
      },
    },
  },
  {
    id: "E07",
    subjectKind: "request",
    subjectId: "R20",
    at: "2026-06-23T06:02:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k11",
    reason: {
      public: null,
      internal: "Approval was requested on arrival; Kramerius already has it.",
    },
    code: "request.held",
    data: {
      why: "copy_exists",
    },
  },
  {
    id: "E08",
    subjectKind: "request",
    subjectId: "R20",
    at: "2026-06-23T06:00:00Z",
    actor: {
      kind: "user",
      userId: "a1",
    },
    correlationId: "k11",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0042",
        name: "harvest-2026-06-23",
      },
      source: null,
    },
  },
  {
    id: "E09",
    subjectKind: "iteration",
    subjectId: "IT17",
    at: "2026-06-19T08:41:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k12",
    reason: {
      public: null,
      internal: null,
    },
    code: "iteration.ingest_failed",
    data: {
      attempt: 1,
      error: "Catalog record has no 245 field.",
    },
  },
  {
    id: "E112",
    subjectKind: "request",
    subjectId: "R26",
    at: "2026-06-22T15:10:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k13",
    reason: {
      public: null,
      internal: "Over Kramerius: published. Existing scan is 150 dpi.",
    },
    code: "request.approved",
    data: {
      iterationId: "IT16",
      isRescan: true,
      batchSize: 1,
    },
  },
  {
    id: "E11",
    subjectKind: "iteration",
    subjectId: "IT15",
    at: "2026-06-24T07:00:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k14",
    reason: {
      public: null,
      internal: null,
    },
    code: "iteration.copy_found",
    data: {
      registry: "Kramerius",
      state: "Published",
    },
  },
  {
    id: "E12",
    subjectKind: "iteration",
    subjectId: "IT9",
    at: "2026-06-21T08:55:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k5",
    reason: {
      public: null,
      internal: "Large-format scanner unavailable until Q4.",
    },
    code: "iteration.cancelled",
    data: {
      list: null,
    },
  },
  {
    id: "E13",
    subjectKind: "iteration",
    subjectId: "IT9",
    at: "2026-06-20T17:02:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k6",
    reason: {
      public: null,
      internal: null,
    },
    code: "iteration.unlisted",
    data: {
      list: {
        id: "L-2026-014",
        name: "Periodika — summer run",
      },
      why: "cancelled",
    },
  },
  {
    id: "E14",
    subjectKind: "iteration",
    subjectId: "IT7",
    at: "2026-06-14T10:31:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k7",
    reason: {
      public: null,
      internal: null,
    },
    code: "iteration.ingest_failed",
    data: {
      attempt: 3,
      error: "Catalog adapter returned HTTP 502 after 3 attempts.",
    },
  },
  {
    id: "E15",
    subjectKind: "iteration",
    subjectId: "IT11",
    at: "2026-06-20T13:44:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k8",
    reason: {
      public: null,
      internal: "cannot plan capacity without a page count.",
    },
    code: "iteration.verdict_denied",
    data: {
      defects: [
        {
          instance: {
            id: "pi1",
            name: "MZK Aleph",
          },
          rule: "R01",
        },
      ],
    },
  },
  {
    id: "E16",
    subjectKind: "iteration",
    subjectId: "IT12",
    at: "2026-06-12T09:00:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k9",
    reason: {
      public: null,
      internal: "18 images delivered.",
    },
    code: "iteration.digitized",
    data: {
      list: {
        id: "L-2026-012",
        name: "Moravica — June",
      },
    },
  },
  {
    id: "E17",
    subjectKind: "iteration",
    subjectId: "IT18",
    at: "2026-06-24T06:15:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k15",
    reason: {
      public: null,
      internal: "New: Default ruleset R07 on 260$c. Page count R03 found again, still accepted.",
    },
    code: "iteration.rechecked",
    data: {
      by: "catalog_change",
      found: 1,
      gone: 0,
    },
  },
  {
    id: "E18",
    subjectKind: "iteration",
    subjectId: "IT18",
    at: "2026-06-18T10:20:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k16",
    reason: {
      public: null,
      internal: "an estimate is enough to plan a regional run.",
    },
    code: "iteration.verdict_accepted",
    data: {
      defects: [
        {
          instance: {
            id: "pi1",
            name: "MZK Aleph",
          },
          rule: "R03",
        },
      ],
    },
  },
  {
    id: "E19",
    subjectKind: "iteration",
    subjectId: "IT19",
    at: "2026-06-23T09:02:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k17",
    reason: {
      public: null,
      internal: "Approved on arrival from Periodical gaps.",
    },
    code: "iteration.ingested",
    data: {},
  },
  {
    id: "E20",
    subjectKind: "list",
    subjectId: "L-2026-015",
    at: "2026-06-22T14:05:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k20",
    reason: {
      public: null,
      internal:
        "pages 4 000 · Periodicals only · 3 picked · 1 460 pp short: the rest of Periodicals was still in review",
    },
    code: "list.created",
    data: {
      generator: {
        name: "PriorityThenMix",
        version: "1.2.0",
      },
      members: 3,
    },
  },
  {
    id: "E22",
    subjectKind: "list",
    subjectId: "L-2026-014",
    at: "2026-06-15T09:30:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k21",
    reason: {
      public: null,
      internal: "22 Jun → 10 Jul · built by hand",
    },
    code: "list.created",
    data: {
      generator: null,
      members: 4,
    },
  },
  {
    id: "E23",
    subjectKind: "list",
    subjectId: "L-2026-014",
    at: "2026-06-15T09:30:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k21",
    reason: {
      public: null,
      internal: null,
    },
    code: "list.members_changed",
    data: {
      added: ["IT5", "IT21", "IT22", "IT23", "IT9"],
      removed: [],
    },
  },
  {
    id: "E24",
    subjectKind: "list",
    subjectId: "L-2026-014",
    at: "2026-06-20T17:02:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k6",
    reason: {
      public: null,
      internal: "Mapa Moravy 1846 — large-format scanner unavailable until Q4",
    },
    code: "list.members_changed",
    data: {
      added: [],
      removed: ["IT9"],
    },
  },
  {
    id: "E25",
    subjectKind: "list",
    subjectId: "L-2026-016",
    at: "2026-06-24T15:40:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k22",
    reason: {
      public: null,
      internal: "2 → 20 Nov · built by hand · empty",
    },
    code: "list.created",
    data: {
      generator: null,
      members: 0,
    },
  },
  {
    id: "E26",
    subjectKind: "list",
    subjectId: "L-2026-012",
    at: "2026-05-20T10:00:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k23",
    reason: {
      public: null,
      internal: "1 → 19 Jun · built by hand",
    },
    code: "list.created",
    data: {
      generator: null,
      members: 3,
    },
  },
  {
    id: "E27",
    subjectKind: "list",
    subjectId: "L-2026-012",
    at: "2026-05-20T10:00:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k23",
    reason: {
      public: null,
      internal: null,
    },
    code: "list.members_changed",
    data: {
      added: ["IT1", "IT12", "IT20"],
      removed: [],
    },
  },
  {
    id: "E28",
    subjectKind: "project",
    subjectId: "p1",
    at: "2025-06-12T10:15:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k30",
    reason: {
      public: null,
      internal: "1 Jul 2025 → 30 Jun 2027 · 6 000 pp",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E29",
    subjectKind: "project",
    subjectId: "p1",
    at: "2025-06-30T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k31",
    reason: {
      public: null,
      internal: null,
    },
    code: "project.member_added",
    data: {
      userId: "u1",
    },
  },
  {
    id: "E31",
    subjectKind: "project",
    subjectId: "p2",
    at: "2025-12-04T13:40:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k33",
    reason: {
      public: null,
      internal: "1 Jan → 31 Dec 2026 · 3 000 pp",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E32",
    subjectKind: "project",
    subjectId: "p3",
    at: "2023-11-20T11:00:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k34",
    reason: {
      public: null,
      internal: "1 Jan 2024 → 31 Dec 2025 · 1 200 pp",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E33",
    subjectKind: "project",
    subjectId: "p3",
    at: "2025-12-08T09:30:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k35",
    reason: {
      public: null,
      internal: "the provider granted a closing year",
    },
    code: "project.dates_changed",
    data: {
      changes: [
        {
          field: "ends",
          from: "2025-12-31",
          to: "2026-12-31",
        },
      ],
    },
  },
  {
    id: "E34",
    subjectKind: "project",
    subjectId: "p4",
    at: "2026-06-18T14:20:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k36",
    reason: {
      public: null,
      internal: "1 Sep 2026 → 31 Aug 2028 · 2 000 pp · no intention yet",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E35",
    subjectKind: "project",
    subjectId: "p5",
    at: "2024-12-02T10:00:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k37",
    reason: {
      public: null,
      internal: "1 Jan → 31 Dec 2025 · 2 500 pp",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E36",
    subjectKind: "project",
    subjectId: "p6",
    at: "2024-02-14T09:10:00Z",
    actor: {
      kind: "user",
      userId: "u2",
    },
    correlationId: "k38",
    reason: {
      public: null,
      internal: "1 Mar 2024 → 30 Jun 2025 · 1 200 pp",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E37",
    subjectKind: "project",
    subjectId: "p7",
    at: "2021-12-10T15:30:00Z",
    actor: {
      kind: "user",
      userId: "u3",
    },
    correlationId: "k39",
    reason: {
      public: null,
      internal: "1 Jan 2022 → 31 Dec 2024 · 900 pp",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E38",
    subjectKind: "iteration",
    subjectId: "IT1",
    at: "2026-04-02T08:12:00Z",
    actor: {
      kind: "system",
    },
    correlationId: "k10",
    reason: {
      public: null,
      internal: null,
    },
    code: "iteration.published",
    data: {
      link: {
        id: "IT1-L1",
        url: "https://kramerius.mzk.cz/view/uuid:demo",
      },
    },
  },
  {
    id: "E39",
    subjectKind: "project",
    subjectId: "p1",
    at: "2025-06-30T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k40",
    reason: {
      public: null,
      internal: null,
    },
    code: "project.approved",
    data: {
      priority: "High",
      approved: 1,
    },
  },
  {
    id: "E40",
    subjectKind: "project",
    subjectId: "p2",
    at: "2025-12-15T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k41",
    reason: {
      public: null,
      internal: null,
    },
    code: "project.approved",
    data: {
      priority: "Normal",
      approved: 1,
    },
  },
  {
    id: "E41",
    subjectKind: "project",
    subjectId: "p3",
    at: "2023-12-04T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u3",
    },
    correlationId: "k42",
    reason: {
      public: null,
      internal: null,
    },
    code: "project.approved",
    data: {
      priority: "High",
      approved: 1,
    },
  },
  {
    id: "E42",
    subjectKind: "project",
    subjectId: "p5",
    at: "2024-12-09T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k43",
    reason: {
      public: null,
      internal: null,
    },
    code: "project.approved",
    data: {
      priority: "Normal",
      approved: 1,
    },
  },
  {
    id: "E43",
    subjectKind: "project",
    subjectId: "p6",
    at: "2024-02-20T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u3",
    },
    correlationId: "k44",
    reason: {
      public: null,
      internal: null,
    },
    code: "project.approved",
    data: {
      priority: "Urgent",
      approved: 1,
    },
  },
  {
    id: "E44",
    subjectKind: "project",
    subjectId: "p7",
    at: "2021-12-10T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u3",
    },
    correlationId: "k45",
    reason: {
      public: null,
      internal: null,
    },
    code: "project.approved",
    data: {
      priority: "Normal",
      approved: 1,
    },
  },
  {
    id: "E45",
    subjectKind: "project",
    subjectId: "p8",
    at: "2026-06-20T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "k46",
    reason: {
      public: null,
      internal: "1 Sep 2026 → 31 Aug 2027 · 800 pp · proposed",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E46",
    subjectKind: "project",
    subjectId: "p9",
    at: "2026-03-02T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "k47",
    reason: {
      public: null,
      internal: "1 Apr → 31 Dec 2026 · 1 500 pp · proposed",
    },
    code: "project.created",
    data: {},
  },
  {
    id: "E47",
    subjectKind: "project",
    subjectId: "p9",
    at: "2026-03-16T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "k48",
    reason: {
      public: null,
      internal:
        "The postcard collection is not catalogued yet, so nothing in it can be proposed. Start a new project once it is in the catalog.",
    },
    code: "project.rejected",
    data: {
      declined: 1,
    },
  },
  {
    id: "E48",
    subjectKind: "request",
    subjectId: "R1",
    at: "2026-03-11T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0009",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0009",
        name: "proposals-2026-03-11",
      },
      source: null,
    },
  },
  {
    id: "E49",
    subjectKind: "request",
    subjectId: "R2",
    at: "2026-05-02T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0012",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0012",
        name: "proposals-2026-05-02",
      },
      source: null,
    },
  },
  {
    id: "E50",
    subjectKind: "request",
    subjectId: "R3",
    at: "2026-06-17T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u6",
    },
    correlationId: "B-0031",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0031",
        name: "proposals-2026-06-17",
      },
      source: null,
    },
  },
  {
    id: "E51",
    subjectKind: "request",
    subjectId: "R4",
    at: "2026-06-09T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0029",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0029",
        name: "proposals-2026-06-09",
      },
      source: null,
    },
  },
  {
    id: "E52",
    subjectKind: "request",
    subjectId: "R5",
    at: "2026-06-21T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a1",
    },
    correlationId: "B-0037",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0037",
        name: "harvest-2026-06-21",
      },
      source: null,
    },
  },
  {
    id: "E53",
    subjectKind: "request",
    subjectId: "R6",
    at: "2026-04-02T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "B-0120",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0120",
        name: "proposals-2026-04-02.csv",
      },
      source: null,
    },
  },
  {
    id: "E54",
    subjectKind: "request",
    subjectId: "R7",
    at: "2026-06-14T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u7",
    },
    correlationId: "B-0138",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0138",
        name: "harvest / Periodical gaps",
      },
      source: null,
    },
  },
  {
    id: "E55",
    subjectKind: "request",
    subjectId: "R0",
    at: "2019-03-12T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0001",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0001",
        name: "proposals-2019-03-12",
      },
      source: null,
    },
  },
  {
    id: "E56",
    subjectKind: "request",
    subjectId: "R8",
    at: "2026-06-03T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a2",
    },
    correlationId: "B-0025",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0025",
        name: "harvest-2026-06-03",
      },
      source: null,
    },
  },
  {
    id: "E57",
    subjectKind: "request",
    subjectId: "R9",
    at: "2026-06-08T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0028",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0028",
        name: "proposals-2026-06-08",
      },
      source: null,
    },
  },
  {
    id: "E58",
    subjectKind: "request",
    subjectId: "R10",
    at: "2026-06-19T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0141",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0141",
        name: "proposals-2026-06-19.csv",
      },
      source: null,
    },
  },
  {
    id: "E59",
    subjectKind: "request",
    subjectId: "R11",
    at: "2026-06-20T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u6",
    },
    correlationId: "B-0141",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0141",
        name: "proposals-2026-06-19.csv",
      },
      source: null,
    },
  },
  {
    id: "E60",
    subjectKind: "request",
    subjectId: "R12",
    at: "2026-05-28T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "B-0022",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0022",
        name: "proposals-2026-05-28",
      },
      source: null,
    },
  },
  {
    id: "E61",
    subjectKind: "request",
    subjectId: "R23",
    at: "2026-06-21T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u6",
    },
    correlationId: "B-0142",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0142",
        name: "proposals-2026-06-21.csv",
      },
      source: null,
    },
  },
  {
    id: "E62",
    subjectKind: "request",
    subjectId: "R24",
    at: "2026-06-20T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a2",
    },
    correlationId: "B-0142",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0142",
        name: "proposals-2026-06-21.csv",
      },
      source: null,
    },
  },
  {
    id: "E63",
    subjectKind: "request",
    subjectId: "R25",
    at: "2026-06-22T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0040",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0040",
        name: "proposals-2026-06-22",
      },
      source: null,
    },
  },
  {
    id: "E64",
    subjectKind: "request",
    subjectId: "R26",
    at: "2026-06-22T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u7",
    },
    correlationId: "B-0142",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0142",
        name: "proposals-2026-06-21.csv",
      },
      source: null,
    },
  },
  {
    id: "E65",
    subjectKind: "request",
    subjectId: "R27",
    at: "2026-06-18T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0141",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0141",
        name: "proposals-2026-06-19.csv",
      },
      source: null,
    },
  },
  {
    id: "E66",
    subjectKind: "request",
    subjectId: "R38",
    at: "2026-06-17T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0032",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0032",
        name: "proposals-2026-06-17",
      },
      source: null,
    },
  },
  {
    id: "E67",
    subjectKind: "request",
    subjectId: "R39",
    at: "2026-06-23T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a2",
    },
    correlationId: "B-0043",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0043",
        name: "harvest-2026-06-23",
      },
      source: null,
    },
  },
  {
    id: "E68",
    subjectKind: "request",
    subjectId: "R40",
    at: "2026-05-12T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0017",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0017",
        name: "proposals-2026-05-12",
      },
      source: null,
    },
  },
  {
    id: "E69",
    subjectKind: "request",
    subjectId: "R41",
    at: "2026-04-28T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a1",
    },
    correlationId: "B-0010",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0010",
        name: "harvest-2026-04-28",
      },
      source: null,
    },
  },
  {
    id: "E70",
    subjectKind: "request",
    subjectId: "R42",
    at: "2026-05-06T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0014",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0014",
        name: "proposals-2026-05-06",
      },
      source: null,
    },
  },
  {
    id: "E71",
    subjectKind: "request",
    subjectId: "R43",
    at: "2026-05-14T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u6",
    },
    correlationId: "B-0018",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0018",
        name: "proposals-2026-05-14",
      },
      source: null,
    },
  },
  {
    id: "E72",
    subjectKind: "request",
    subjectId: "R44",
    at: "2026-04-30T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0011",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0011",
        name: "proposals-2026-04-30",
      },
      source: null,
    },
  },
  {
    id: "E73",
    subjectKind: "request",
    subjectId: "R45",
    at: "2026-05-02T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a2",
    },
    correlationId: "B-0013",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0013",
        name: "harvest-2026-05-02",
      },
      source: null,
    },
  },
  {
    id: "E74",
    subjectKind: "request",
    subjectId: "R46",
    at: "2026-05-26T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u6",
    },
    correlationId: "B-0021",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0021",
        name: "proposals-2026-05-26",
      },
      source: null,
    },
  },
  {
    id: "E75",
    subjectKind: "request",
    subjectId: "R47",
    at: "2026-05-09T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0015",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0015",
        name: "proposals-2026-05-09",
      },
      source: null,
    },
  },
  {
    id: "E76",
    subjectKind: "request",
    subjectId: "R48",
    at: "2026-06-01T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a2",
    },
    correlationId: "B-0023",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0023",
        name: "harvest-2026-06-01",
      },
      source: null,
    },
  },
  {
    id: "E77",
    subjectKind: "request",
    subjectId: "R49",
    at: "2026-06-04T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u7",
    },
    correlationId: "B-0027",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0027",
        name: "proposals-2026-06-04",
      },
      source: null,
    },
  },
  {
    id: "E78",
    subjectKind: "request",
    subjectId: "R50",
    at: "2026-05-21T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0020",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0020",
        name: "proposals-2026-05-21",
      },
      source: null,
    },
  },
  {
    id: "E79",
    subjectKind: "request",
    subjectId: "R51",
    at: "2026-05-18T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0019",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0019",
        name: "proposals-2026-05-18",
      },
      source: null,
    },
  },
  {
    id: "E80",
    subjectKind: "request",
    subjectId: "R52",
    at: "2026-05-11T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "B-0016",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0016",
        name: "proposals-2026-05-11",
      },
      source: null,
    },
  },
  {
    id: "E81",
    subjectKind: "request",
    subjectId: "R53",
    at: "2026-06-03T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u6",
    },
    correlationId: "B-0024",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0024",
        name: "proposals-2026-06-03",
      },
      source: null,
    },
  },
  {
    id: "E82",
    subjectKind: "request",
    subjectId: "R54",
    at: "2025-01-14T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "B-0006",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0006",
        name: "proposals-2025-01-14",
      },
      source: null,
    },
  },
  {
    id: "E83",
    subjectKind: "request",
    subjectId: "R55",
    at: "2025-03-03T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0007",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0007",
        name: "proposals-2025-03-03",
      },
      source: null,
    },
  },
  {
    id: "E84",
    subjectKind: "request",
    subjectId: "R56",
    at: "2025-03-20T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "B-0008",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0008",
        name: "proposals-2025-03-20",
      },
      source: null,
    },
  },
  {
    id: "E85",
    subjectKind: "request",
    subjectId: "R57",
    at: "2024-03-11T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0004",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0004",
        name: "proposals-2024-03-11",
      },
      source: null,
    },
  },
  {
    id: "E86",
    subjectKind: "request",
    subjectId: "R58",
    at: "2024-10-09T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "B-0005",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0005",
        name: "proposals-2024-10-09",
      },
      source: null,
    },
  },
  {
    id: "E87",
    subjectKind: "request",
    subjectId: "R59",
    at: "2022-02-02T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0002",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0002",
        name: "proposals-2022-02-02",
      },
      source: null,
    },
  },
  {
    id: "E88",
    subjectKind: "request",
    subjectId: "R60",
    at: "2023-05-15T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u1",
    },
    correlationId: "B-0003",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0003",
        name: "proposals-2023-05-15",
      },
      source: null,
    },
  },
  {
    id: "E89",
    subjectKind: "request",
    subjectId: "R13",
    at: "2026-06-04T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u7",
    },
    correlationId: "B-0026",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0026",
        name: "proposals-2026-06-04",
      },
      source: null,
    },
  },
  {
    id: "E90",
    subjectKind: "request",
    subjectId: "R14",
    at: "2026-06-19T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0034",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0034",
        name: "proposals-2026-06-19",
      },
      source: null,
    },
  },
  {
    id: "E91",
    subjectKind: "request",
    subjectId: "R15",
    at: "2026-06-20T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0035",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0035",
        name: "proposals-2026-06-20",
      },
      source: null,
    },
  },
  {
    id: "E92",
    subjectKind: "request",
    subjectId: "R16",
    at: "2026-06-22T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u6",
    },
    correlationId: "B-0038",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0038",
        name: "proposals-2026-06-22",
      },
      source: null,
    },
  },
  {
    id: "E93",
    subjectKind: "request",
    subjectId: "R17",
    at: "2026-06-22T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0039",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0039",
        name: "proposals-2026-06-22",
      },
      source: null,
    },
  },
  {
    id: "E94",
    subjectKind: "request",
    subjectId: "R18",
    at: "2026-06-23T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u7",
    },
    correlationId: "B-0041",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0041",
        name: "proposals-2026-06-23",
      },
      source: null,
    },
  },
  {
    id: "E95",
    subjectKind: "request",
    subjectId: "R19",
    at: "2026-06-21T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0036",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0036",
        name: "proposals-2026-06-21",
      },
      source: null,
    },
  },
  {
    id: "E96",
    subjectKind: "request",
    subjectId: "R21",
    at: "2026-06-18T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u6",
    },
    correlationId: "B-0033",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0033",
        name: "proposals-2026-06-18",
      },
      source: null,
    },
  },
  {
    id: "E97",
    subjectKind: "request",
    subjectId: "R22",
    at: "2026-06-10T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0030",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0030",
        name: "proposals-2026-06-10",
      },
      source: null,
    },
  },
  {
    id: "E98",
    subjectKind: "request",
    subjectId: "R28",
    at: "2026-06-24T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0143",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0143",
        name: "shelf ST1-04",
      },
      source: null,
    },
  },
  {
    id: "E99",
    subjectKind: "request",
    subjectId: "R29",
    at: "2026-06-24T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0143",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0143",
        name: "shelf ST1-04",
      },
      source: null,
    },
  },
  {
    id: "E100",
    subjectKind: "request",
    subjectId: "R30",
    at: "2026-06-24T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0143",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0143",
        name: "shelf ST1-04",
      },
      source: null,
    },
  },
  {
    id: "E101",
    subjectKind: "request",
    subjectId: "R31",
    at: "2026-06-24T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0143",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0143",
        name: "shelf ST1-04",
      },
      source: null,
    },
  },
  {
    id: "E102",
    subjectKind: "request",
    subjectId: "R32",
    at: "2026-06-24T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u4",
    },
    correlationId: "B-0143",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0143",
        name: "shelf ST1-04",
      },
      source: null,
    },
  },
  {
    id: "E103",
    subjectKind: "request",
    subjectId: "R33",
    at: "2026-06-24T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0144",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0144",
        name: "brno-almanacs.txt",
      },
      source: null,
    },
  },
  {
    id: "E104",
    subjectKind: "request",
    subjectId: "R34",
    at: "2026-06-24T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0144",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0144",
        name: "brno-almanacs.txt",
      },
      source: null,
    },
  },
  {
    id: "E105",
    subjectKind: "request",
    subjectId: "R35",
    at: "2026-06-24T09:00:00Z",
    actor: {
      kind: "user",
      userId: "u5",
    },
    correlationId: "B-0144",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0144",
        name: "brno-almanacs.txt",
      },
      source: null,
    },
  },
  {
    id: "E106",
    subjectKind: "request",
    subjectId: "R36",
    at: "2026-06-25T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a2",
    },
    correlationId: "B-0145",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0145",
        name: "ISSN sweep, 25 Jun",
      },
      source: null,
    },
  },
  {
    id: "E107",
    subjectKind: "request",
    subjectId: "R37",
    at: "2026-06-25T09:00:00Z",
    actor: {
      kind: "user",
      userId: "a2",
    },
    correlationId: "B-0145",
    reason: {
      public: null,
      internal: null,
    },
    code: "request.created",
    data: {
      batch: {
        id: "B-0145",
        name: "ISSN sweep, 25 Jun",
      },
      source: null,
    },
  },
];
