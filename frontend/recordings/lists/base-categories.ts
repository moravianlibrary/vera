const call = (method: string, path: string, as: string, requestBody?: unknown) => ({
  as,
  method,
  path,
  ...(requestBody === undefined ? {} : { requestBody }),
  compare: "body" as const,
});
const get = (path: string, as: string) => call("GET", path, as);
const people = ["admin", "curator", "digitization", "staff", "reader", "no-access", "project-user"];

export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "decisions",
  scenarios: [
    {
      name: "reads",
      calls: [
        ...people.flatMap((person) => [
          get("/api/categories", person),
          get("/api/categories/overview", person),
        ]),
        get("/api/categories/c22/impact", "admin"),
        get("/api/categories/c22/impact", "no-access"),
        get("/api/categories/c404/impact", "admin"),
      ],
    },
    {
      name: "reads-czech-name",
      calls: [
        {
          as: "admin",
          method: "GET",
          path: "/api/categories",
          acceptLanguage: "cs",
          compare: "body",
        },
      ],
    },
    {
      name: "create-category",
      calls: [
        call("POST", "/api/categories", "curator", {
          names: { en: "Recording child" },
          parentId: "c2",
        }),
        get("/api/categories", "curator"),
        get("/api/categories/overview", "curator"),
      ],
    },
    {
      name: "save-category",
      calls: [
        call("PUT", "/api/categories/c23", "admin", {
          names: { en: "Specialist press" },
          parentId: "c1",
        }),
        get("/api/categories", "admin"),
        get("/api/categories/overview", "admin"),
      ],
    },
    {
      name: "delete-category",
      calls: [
        call("POST", "/api/categories", "admin", {
          names: { en: "Disposable category" },
          parentId: null,
        }),
        call("DELETE", "/api/categories/c33", "admin"),
        get("/api/categories", "admin"),
        get("/api/categories/overview", "admin"),
      ],
    },
    {
      name: "refuse-delete-scoped-category",
      calls: [
        call("POST", "/api/categories", "admin", { names: { en: "Scoped leaf" }, parentId: null }),
        call("POST", "/api/intentions", "digitization", {
          name: "Scoped leaf intention",
          description: "",
          funding: { kind: "any" },
          scopeCategoryId: "c33",
          countsFrom: "2026-07-01",
          endsOn: "2026-12-31",
          targetPages: 1000,
          mix: { kind: "use", mixId: "d1", revision: null },
        }),
        { as: "admin", method: "DELETE", path: "/api/categories/c33", compare: "code" },
      ],
    },
    {
      name: "set-category-custody",
      calls: [
        call("PUT", "/api/categories/c22/custody", "curator", { groupIds: [], userIds: ["u4"] }),
        get("/api/categories/overview", "curator"),
      ],
    },
    {
      name: "refine-category",
      calls: [
        call("POST", "/api/categories/c32/refine", "admin", { names: { en: "Before 1800" } }),
        get("/api/categories", "admin"),
        get("/api/categories/overview", "admin"),
      ],
    },
    {
      name: "category-refusals",
      calls: [
        call("POST", "/api/categories", "reader", {
          names: { en: "No permission" },
          parentId: "c2",
        }),
        call("POST", "/api/categories", "admin", {
          names: { en: "Missing parent" },
          parentId: "c404",
        }),
        call("POST", "/api/categories", "admin", { names: { en: "Brno" }, parentId: "c21" }),
        call("POST", "/api/categories", "admin", { names: { en: "Regional" }, parentId: "c2" }),
        call("POST", "/api/categories", "admin", { names: { en: " " }, parentId: "c2" }),
        call("PUT", "/api/categories/c23", "reader", {
          names: { en: "No permission" },
          parentId: "c2",
        }),
        call("PUT", "/api/categories/c23", "admin", { names: { en: " " }, parentId: "c2" }),
        call("PUT", "/api/categories/c1", "admin", {
          names: { en: "Monographs" },
          parentId: "c11",
        }),
        call("PUT", "/api/categories/c23", "admin", {
          names: { en: "Specialist" },
          parentId: "c404",
        }),
        call("PUT", "/api/categories/c23", "admin", {
          names: { en: "Specialist" },
          parentId: "c21",
        }),
        call("PUT", "/api/categories/c23", "admin", { names: { en: "Regional" }, parentId: "c2" }),
        call("PUT", "/api/categories/c21/custody", "admin", { groupIds: [], userIds: ["missing"] }),
        call("PUT", "/api/categories/c11/custody", "curator", { groupIds: [], userIds: [] }),
        call("PUT", "/api/categories/c22/custody", "curator", { groupIds: ["g404"], userIds: [] }),
        call("DELETE", "/api/categories/c22", "reader"),
        call("DELETE", "/api/categories/c3", "admin"),
        call("DELETE", "/api/categories/c21", "admin"),
        call("DELETE", "/api/categories/c22", "admin"),
        call("POST", "/api/categories/c3/refine", "admin", { names: { en: "Refined child" } }),
        call("POST", "/api/categories/c3/refine", "reader", { names: { en: "No permission" } }),
        call("POST", "/api/categories/c32/refine", "admin", { names: { en: " " } }),
        call("POST", "/api/categories/c31/refine", "admin", { names: { en: "Medieval" } }),
      ],
    },
  ],
} as const;
