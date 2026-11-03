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
      name: "create-category",
      calls: [
        call("POST", "/api/categories", "curator", { name: "Recording child", parentId: "c2" }),
        get("/api/categories", "curator"),
        get("/api/categories/overview", "curator"),
      ],
    },
    {
      name: "save-category",
      calls: [
        call("PUT", "/api/categories/c23", "admin", { name: "Specialist press", parentId: "c1" }),
        get("/api/categories", "admin"),
        get("/api/categories/overview", "admin"),
      ],
    },
    {
      name: "delete-category",
      calls: [
        call("POST", "/api/categories", "admin", { name: "Disposable category", parentId: null }),
        call("DELETE", "/api/categories/c33", "admin"),
        get("/api/categories", "admin"),
        get("/api/categories/overview", "admin"),
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
        call("POST", "/api/categories/c32/refine", "admin", { name: "Before 1800" }),
        get("/api/categories", "admin"),
        get("/api/categories/overview", "admin"),
      ],
    },
    {
      name: "category-refusals",
      calls: [
        call("POST", "/api/categories", "reader", { name: "No permission", parentId: "c2" }),
        call("POST", "/api/categories", "admin", { name: "Missing parent", parentId: "c404" }),
        call("POST", "/api/categories", "admin", { name: "Brno", parentId: "c21" }),
        call("POST", "/api/categories", "admin", { name: "Regional", parentId: "c2" }),
        call("POST", "/api/categories", "admin", { name: " ", parentId: "c2" }),
        call("PUT", "/api/categories/c23", "reader", { name: "No permission", parentId: "c2" }),
        call("PUT", "/api/categories/c23", "admin", { name: " ", parentId: "c2" }),
        call("PUT", "/api/categories/c1", "admin", { name: "Monographs", parentId: "c11" }),
        call("PUT", "/api/categories/c23", "admin", { name: "Specialist", parentId: "c404" }),
        call("PUT", "/api/categories/c23", "admin", { name: "Specialist", parentId: "c21" }),
        call("PUT", "/api/categories/c23", "admin", { name: "Regional", parentId: "c2" }),
        call("PUT", "/api/categories/c21/custody", "admin", { groupIds: [], userIds: ["missing"] }),
        call("PUT", "/api/categories/c11/custody", "curator", { groupIds: [], userIds: [] }),
        call("PUT", "/api/categories/c22/custody", "curator", { groupIds: ["g404"], userIds: [] }),
        call("DELETE", "/api/categories/c22", "reader"),
        call("DELETE", "/api/categories/c3", "admin"),
        call("DELETE", "/api/categories/c21", "admin"),
        call("DELETE", "/api/categories/c22", "admin"),
        call("POST", "/api/categories/c3/refine", "admin", { name: "Refined child" }),
        call("POST", "/api/categories/c3/refine", "reader", { name: "No permission" }),
        call("POST", "/api/categories/c32/refine", "admin", { name: " " }),
        call("POST", "/api/categories/c31/refine", "admin", { name: "Medieval" }),
      ],
    },
  ],
} as const;
