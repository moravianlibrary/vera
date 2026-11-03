const profiles = [
  "admin",
  "curator",
  "digitization",
  "staff",
  "reader",
  "no-access",
  "project-user",
] as const;
const taskRead = (as: (typeof profiles)[number]) =>
  as === "admin" || as === "curator" || as === "digitization";

export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "none",
  scenarios: [
    {
      name: "reads",
      calls: profiles.flatMap((as) => [
        { as, method: "GET", path: "/api/tasks", compare: taskRead(as) ? "body" : "code" },
        { as, method: "GET", path: "/api/tasks/running", compare: taskRead(as) ? "body" : "code" },
      ]),
    },
    {
      name: "run-detail-and-log",
      calls: [
        { as: "admin", method: "GET", path: "/api/tasks/T-9905", compare: "body" },
        { as: "curator", method: "GET", path: "/api/tasks/T-9905", compare: "code" },
        { as: "admin", method: "GET", path: "/api/tasks/T-9999", compare: "code" },
        { as: "admin", method: "GET", path: "/api/tasks/T-9905/log", compare: "body" },
        { as: "curator", method: "GET", path: "/api/tasks/T-9905/log", compare: "code" },
        { as: "admin", method: "GET", path: "/api/tasks/T-9999/log", compare: "code" },
      ],
    },
    {
      name: "change-retention",
      calls: [
        {
          as: "admin",
          method: "PUT",
          path: "/api/tasks/retention",
          requestBody: { days: 60, failedDays: 365 },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/tasks", compare: "body" },
        {
          as: "admin",
          method: "PUT",
          path: "/api/tasks/retention",
          requestBody: { days: 90, failedDays: 30 },
          compare: "code",
        },
        {
          as: "curator",
          method: "PUT",
          path: "/api/tasks/retention",
          requestBody: { days: 60, failedDays: 365 },
          compare: "code",
        },
      ],
    },
    {
      name: "cancel-run",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/tasks/T-9916/cancel",
          requestBody: {},
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/tasks", compare: "body" },
        { as: "admin", method: "GET", path: "/api/tasks/T-9916", compare: "body" },
        {
          as: "admin",
          method: "POST",
          path: "/api/tasks/T-9905/cancel",
          requestBody: {},
          compare: "code",
        },
      ],
    },
    {
      name: "rerun-failed-plugin-task",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/tasks/T-9897/rerun",
          requestBody: {},
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/tasks", compare: "body" },
        {
          as: "admin",
          method: "POST",
          path: "/api/tasks/T-9905/rerun",
          requestBody: {},
          compare: "code",
        },
      ],
    },
  ],
} as const;
