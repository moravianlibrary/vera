const documentStaffFilters = [
  "q=Lidov%C3%A9",
  "status=Available",
  "mine=1@staff",
  "decision=Approved",
  "progress=Published",
  "validation=Needed",
  "forbidden=No",
  "cancelled=No",
  "category=c22",
  "project=p1",
  "priority=Normal",
  "copy=None",
  "asker=u5",
  "pages=1000..3000",
  "asked=2026-03-01..2026-06-25",
  "p.size=A2",
  "p.size.none=1",
  "progress=Ready,Published",
  "progress=Ready&project=p1",
  "group=batch",
  "group=project",
  "limit=2",
] as const;

const documentReaderFilters = [
  "q=Lidov%C3%A9",
  "status=Available",
  "perspective=my",
  "p.material_type=Periodical",
  "p.size.none=1",
  "status=Available,NotAvailable",
  "status=Available&perspective=my",
  "decision=Approved",
] as const;

const requestFilters = [
  "q=Ostravsk%C3%BD",
  "decision=Pending",
  "custody=pc1",
  "type=Periodical",
  "project=p1",
  "copy=None",
  "asker=u5",
  "batch=B-0143",
  "source=pi1",
  "askers=One",
  "after=No",
  "asked=2026-06-17..2026-06-25",
  "p.size=A2",
  "p.size.none=1",
  "decision=Pending,Withdrawn",
  "decision=Pending&type=Periodical",
  "group=batch",
  "group=requester",
  "limit=2",
] as const;

function calls(profile: string, resource: "documents" | "requests", filters: readonly string[]) {
  const base = `/api/${resource}`;
  return [
    { as: profile, method: "GET", path: base, compare: "body" },
    ...filters.map((filter) => {
      const [query, as = profile] = filter.split("@");
      return {
        as,
        method: "GET",
        path: `${base}?${query}`,
        compare: "body",
      };
    }),
    ...(resource === "documents" && profile === "reader"
      ? [{ as: profile, method: "GET", path: `${base}?limit=2`, compare: "body" }]
      : []),
    {
      as: profile,
      method: "GET",
      path: `${base}?limit=2&cursor=${resource === "documents" ? (profile === "reader" ? "D30" : "D3") : "D20"}`,
      compare: "body",
    },
  ];
}

export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "none",
  scenarios: [
    { name: "documents-admin", calls: calls("admin", "documents", documentStaffFilters) },
    { name: "documents-reader", calls: calls("reader", "documents", documentReaderFilters) },
    { name: "requests-admin", calls: calls("admin", "requests", requestFilters) },
    { name: "requests-curator", calls: calls("curator", "requests", requestFilters) },
  ],
};
