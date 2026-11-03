const project = (method: string, path: string, as: string, requestBody?: unknown) => ({
  as,
  method,
  path,
  ...(requestBody === undefined ? {} : { requestBody }),
  compare: "body" as const,
});
const get = (path: string, as: string) => project("GET", path, as);
const draft = {
  name: "Recorded project",
  description: "A project recorded for backend replay.",
  startsOn: "2026-09-01",
  endsOn: "2027-08-31",
  targetPages: 1000,
};
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
          get("/api/projects", person),
          get("/api/projects/overview", person),
        ]),
        get("/api/projects/p1", "digitization"),
        get("/api/projects/p1", "reader"),
        get("/api/projects/p404", "curator"),
      ],
    },
    {
      name: "create-project",
      calls: [
        project("POST", "/api/projects", "curator", draft),
        get("/api/projects", "curator"),
        get("/api/projects/overview", "curator"),
        get("/api/projects/p10", "curator"),
      ],
    },
    {
      name: "preview-project-change",
      calls: [
        project("POST", "/api/projects/p1/preview", "digitization", {
          ...draft,
          name: "Updated project",
        }),
        get("/api/projects/overview", "digitization"),
        get("/api/projects/p1", "digitization"),
      ],
    },
    {
      name: "save-project",
      calls: [
        project("PUT", "/api/projects/p1", "digitization", { ...draft, name: "Updated project" }),
        get("/api/projects/overview", "digitization"),
        get("/api/projects/p1", "digitization"),
      ],
    },
    {
      name: "set-project-members",
      calls: [
        project("PUT", "/api/projects/p1/members", "digitization", {
          managerId: "u2",
          memberIds: ["u2", "u4"],
          memberGroupIds: ["g3"],
        }),
        get("/api/projects/overview", "digitization"),
        get("/api/projects/p1", "digitization"),
      ],
    },
    {
      name: "decide-project",
      calls: [
        get("/api/projects/p8/decision", "curator"),
        project("POST", "/api/projects/p8/approve", "curator", { priority: "High" }),
        get("/api/projects/overview", "curator"),
        get("/api/projects/p8", "curator"),
      ],
    },
    {
      name: "reject-project",
      calls: [
        project("POST", "/api/projects/p4/reject", "curator", { reason: "The call was not won." }),
        get("/api/projects/overview", "curator"),
        get("/api/projects/p4", "curator"),
      ],
    },
    {
      name: "delete-project",
      calls: [
        project("POST", "/api/projects", "digitization", draft),
        project("DELETE", "/api/projects/p10", "digitization"),
        get("/api/projects", "digitization"),
        get("/api/projects/overview", "digitization"),
      ],
    },
    {
      name: "project-refusals",
      calls: [
        project("POST", "/api/projects", "staff", draft),
        project("POST", "/api/projects", "curator", { ...draft, endsOn: "2026-01-01" }),
        project("POST", "/api/projects", "curator", { ...draft, name: " " }),
        project("PUT", "/api/projects/p1/members", "digitization", {
          managerId: "u999",
          memberIds: ["u999"],
          memberGroupIds: [],
        }),
        project("PUT", "/api/projects/p1/members", "digitization", {
          managerId: "u2",
          memberIds: ["u2"],
          memberGroupIds: ["g404"],
        }),
        project("POST", "/api/projects/p1/preview", "staff", draft),
        project("POST", "/api/projects/p1/preview", "digitization", { ...draft, targetPages: 0 }),
        project("PUT", "/api/projects/p1", "staff", draft),
        project("PUT", "/api/projects/p1", "digitization", { ...draft, name: " " }),
        get("/api/projects/p1/decision", "staff"),
        get("/api/projects/p1/decision", "curator"),
        project("POST", "/api/projects/p1/approve", "staff", { priority: "High" }),
        project("POST", "/api/projects/p4/approve", "curator", { priority: "Unknown" }),
        project("POST", "/api/projects/p1/approve", "curator", { priority: "High" }),
        project("POST", "/api/projects/p4/reject", "staff", { reason: "Denied" }),
        project("POST", "/api/projects/p4/reject", "curator", { reason: " " }),
        project("POST", "/api/projects/p1/reject", "curator", { reason: "Already decided" }),
        project("DELETE", "/api/projects/p9", "staff"),
        project("DELETE", "/api/projects/p1", "digitization"),
      ],
    },
  ],
} as const;
