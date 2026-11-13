const profiles = [
  "admin",
  "curator",
  "digitization",
  "staff",
  "reader",
  "no-access",
  "project-user",
] as const;
const get = (path: string, as: (typeof profiles)[number], compare: "body" | "code" = "body") => ({
  as,
  method: "GET",
  path,
  compare,
});
const act = (
  method: string,
  path: string,
  as: string,
  compare: "body" | "code" = "body",
  requestBody?: unknown,
) => ({ as, method, path, compare, ...(requestBody === undefined ? {} : { requestBody }) });
export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "decisions",
  scenarios: [
    {
      name: "reads",
      calls: [
        ...profiles.map((profile) =>
          get(
            "/api/mixes",
            profile,
            ["reader", "staff", "no-access", "project-user"].includes(profile) ? "code" : "body",
          ),
        ),
        get("/api/mixes/d1", "curator"),
        get("/api/mixes/d1", "reader", "code"),
        get("/api/mixes/unknown", "admin", "code"),
      ],
    },
    {
      name: "reads-czech-name",
      calls: [
        { as: "admin", method: "GET", path: "/api/mixes", acceptLanguage: "cs", compare: "body" },
      ],
    },
    {
      name: "create-save-snapshot-primary-archive",
      calls: [
        act("POST", "/api/mixes", "admin", "body", {
          names: { en: "Recording mix" },
          fromMixId: "d2",
          fromRevision: 2,
        }),
        act("GET", "/api/mixes/d3", "admin"),
        act("PUT", "/api/mixes/d3/sets", "admin", "body", {
          parentId: null,
          shares: { c1: 25, c2: 65, c3: 10, c4: 0 },
          revision: 1,
        }),
        act("GET", "/api/mixes/d3", "admin"),
        act("POST", "/api/mixes/d3/snapshots", "admin", "body", { revision: 1, label: "Approved" }),
        act("POST", "/api/mixes/d3/snapshots", "admin", "code", {
          revision: 1,
          label: "Duplicate label",
        }),
        act("GET", "/api/mixes/d3", "admin"),
        act("POST", "/api/mixes/d3/primary", "admin", "body", {}),
        act("GET", "/api/mixes", "admin"),
        act("POST", "/api/mixes/d1/primary", "admin", "body", {}),
        act("POST", "/api/mixes/d3/archive", "admin", "body", {}),
        act("GET", "/api/mixes/d3", "admin"),
      ],
    },
    {
      name: "delete-unused",
      calls: [
        act("POST", "/api/mixes", "admin", "body", {
          names: { en: "Unused recording mix" },
          fromMixId: null,
          fromRevision: null,
        }),
        act("DELETE", "/api/mixes/d3", "admin", "body"),
        get("/api/mixes", "admin"),
      ],
    },
    {
      name: "mix-refusals",
      calls: [
        act("POST", "/api/mixes", "reader", "code", {
          names: { en: "Denied mix" },
          fromMixId: null,
          fromRevision: null,
        }),
        act("POST", "/api/mixes", "admin", "code", {
          names: { en: "House mix" },
          fromMixId: null,
          fromRevision: null,
        }),
        act("POST", "/api/mixes", "admin", "code", {
          names: { en: "Bad revision mix" },
          fromMixId: "d1",
          fromRevision: 999,
        }),
        act("PUT", "/api/mixes/d1/sets", "reader", "code", {
          parentId: null,
          shares: { c1: 25, c2: 65, c3: 10, c4: 0 },
          revision: 4,
        }),
        act("PUT", "/api/mixes/d1/sets", "admin", "code", {
          parentId: null,
          shares: { c1: 25, c2: 65, c3: 10, c4: 0 },
          revision: 3,
        }),
        act("PUT", "/api/mixes/d1/sets", "admin", "code", {
          parentId: null,
          shares: { c1: 30 },
          revision: 4,
        }),
        act("PUT", "/api/mixes/d1/sets", "admin", "code", {
          parentId: null,
          shares: { c1: 50, c2: 50, c3: 10, c4: 0 },
          revision: 4,
        }),
        act("POST", "/api/mixes/d1/snapshots", "admin", "code", {
          revision: 999,
          label: "Missing",
        }),
        act("POST", "/api/mixes/d1/snapshots", "admin", "body", {
          revision: 1,
          label: "First label",
        }),
        act("POST", "/api/mixes/d1/snapshots", "admin", "code", { revision: 1, label: "Again" }),
        act("POST", "/api/mixes/d1/archive", "admin", "code", {}),
        act("DELETE", "/api/mixes/d1", "admin", "code"),
        act("DELETE", "/api/mixes/d2", "admin", "code"),
        act("POST", "/api/mixes/d2/archive", "admin", "body", {}),
        act("PUT", "/api/mixes/d2/sets", "admin", "code", {
          parentId: null,
          shares: { c1: 25, c2: 65, c3: 10, c4: 0 },
          revision: 2,
        }),
        act("POST", "/api/mixes/d2/primary", "admin", "code", {}),
      ],
    },
  ],
} as const;
