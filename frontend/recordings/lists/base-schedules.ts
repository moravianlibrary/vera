const profiles = [
  "admin",
  "curator",
  "digitization",
  "staff",
  "reader",
  "no-access",
  "project-user",
] as const;

export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "none",
  scenarios: [
    {
      name: "reads",
      calls: profiles.map((as) => ({
        as,
        method: "GET",
        path: "/api/schedules?range=day",
        compare: as === "admin" ? "body" : "code",
      })),
    },
    {
      name: "reads-in-Czech",
      calls: [
        {
          as: "admin",
          method: "GET",
          path: "/api/schedules?range=day",
          acceptLanguage: "cs",
          compare: "body",
        },
        {
          as: "admin",
          method: "GET",
          path: "/api/intentions/overview",
          acceptLanguage: "cs",
          compare: "body",
        },
      ],
    },
    {
      name: "create-and-save-schedule",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules",
          requestBody: {
            names: { en: "RDCZ — nightly check" },
            instanceId: "pi5",
            cadence: { every: "day", at: "03:30" },
            overlap: "wait",
          },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/schedules?range=day", compare: "body" },
        {
          as: "admin",
          method: "PUT",
          path: "/api/schedules/s8",
          requestBody: {
            names: { en: "RDCZ — weekly check" },
            cadence: { every: "week", weekday: 0, at: "04:00" },
            overlap: "wait",
          },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/schedules?range=day", compare: "body" },
        { as: "admin", method: "PUT", path: "/api/schedules/s8", requestBody: {}, compare: "code" },
        {
          as: "admin",
          method: "PUT",
          path: "/api/schedules/s8",
          requestBody: {
            names: { en: "Quarterly" },
            cadence: { every: "quarter", at: "00:00" },
            overlap: "wait",
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "PUT",
          path: "/api/schedules/s8",
          requestBody: {
            names: { en: "Too frequent" },
            cadence: { every: "minutes", interval: 3 },
            overlap: "wait",
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules",
          requestBody: {
            names: { en: "Too frequent" },
            instanceId: "pi5",
            cadence: { every: "minutes", interval: 3 },
            overlap: "wait",
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules",
          requestBody: {
            names: { en: "Quarterly" },
            instanceId: "pi5",
            cadence: { every: "quarter", at: "00:00" },
            overlap: "wait",
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules",
          requestBody: {
            names: { en: "Not schedulable" },
            instanceId: "pi14",
            cadence: { every: "day", at: "03:30" },
            overlap: "wait",
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules",
          requestBody: {
            names: { en: "Invalid" },
            instanceId: "pi5",
            cadence: {},
            overlap: "wait",
          },
          compare: "code",
        },
        {
          as: "curator",
          method: "POST",
          path: "/api/schedules",
          requestBody: {
            names: { en: "Denied" },
            instanceId: "pi5",
            cadence: { every: "day", at: "03:30" },
            overlap: "wait",
          },
          compare: "code",
        },
      ],
    },
    {
      name: "pause-and-resume-schedule",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules/s3/pause",
          requestBody: { reason: "RDCZ maintenance window." },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/schedules?range=day", compare: "body" },
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules/s3/resume",
          requestBody: {},
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/schedules?range=day", compare: "body" },
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules/s7/pause",
          requestBody: { reason: "Already paused." },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules/s3/resume",
          requestBody: {},
          compare: "code",
        },
      ],
    },
    {
      name: "run-schedule-now",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/schedules/s3/run",
          requestBody: {},
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/tasks", compare: "body" },
        {
          as: "reader",
          method: "POST",
          path: "/api/schedules/s3/run",
          requestBody: {},
          compare: "code",
        },
      ],
    },
    {
      name: "delete-schedule",
      calls: [
        { as: "admin", method: "DELETE", path: "/api/schedules/s4", compare: "body" },
        { as: "admin", method: "GET", path: "/api/schedules?range=day", compare: "body" },
        { as: "curator", method: "DELETE", path: "/api/schedules/s4", compare: "code" },
      ],
    },
  ],
} as const;
