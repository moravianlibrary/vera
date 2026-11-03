export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "decisions",
  scenarios: [
    {
      name: "a-curator-approves-multi-ask-row",
      calls: [
        {
          as: "curator",
          method: "POST",
          path: "/api/requests/D20/approve",
          requestBody: {
            categoryId: "c21",
            priority: "Normal",
            rescanNote: null,
          },
          compare: "body",
        },
        {
          as: "curator",
          method: "GET",
          path: "/api/requests/D20",
          compare: "body",
        },
        {
          as: "curator",
          method: "GET",
          path: "/api/requests?decision=Approved",
          compare: "body",
        },
        {
          as: "reader",
          method: "GET",
          path: "/api/documents/D20?perspective=my",
          compare: "body",
        },
      ],
    },
    {
      name: "b-curator-declines-with-both-texts",
      calls: [
        {
          as: "curator",
          method: "POST",
          path: "/api/requests/D25/decline",
          requestBody: {
            publicText: "This title is already being digitized.",
            internalText: "The archive confirmed the planned run.",
          },
          compare: "body",
        },
        {
          as: "curator",
          method: "GET",
          path: "/api/requests/D25",
          compare: "body",
        },
        {
          as: "staff",
          method: "GET",
          path: "/api/documents/D25?perspective=my",
          compare: "body",
        },
      ],
    },
    {
      name: "c-reader-withdraws-and-refusals",
      calls: [
        {
          as: "reader",
          method: "POST",
          path: "/api/requests/D21/withdraw",
          compare: "body",
        },
        {
          as: "reader",
          method: "GET",
          path: "/api/documents?perspective=my",
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/requests/D21/withdraw",
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/requests/D2/withdraw",
          compare: "body",
        },
      ],
    },
    {
      name: "d-curator-bulk-approves-batch-with-exclusion",
      calls: [
        {
          as: "curator",
          method: "POST",
          path: "/api/requests/batches/B-0143/approve",
          requestBody: {
            categoryId: "c21",
            priority: "Normal",
            excludedIds: ["D28"],
          },
          compare: "body",
        },
        {
          as: "curator",
          method: "GET",
          path: "/api/requests?group=batch&batch=B-0143",
          compare: "body",
        },
      ],
    },
    {
      name: "e-decision-refusals",
      calls: [
        {
          as: "curator",
          method: "POST",
          path: "/api/requests/D22/approve",
          requestBody: {
            categoryId: "c21",
            priority: "Normal",
            rescanNote: null,
          },
          compare: "body",
        },
        {
          as: "curator",
          method: "POST",
          path: "/api/requests/D24/approve",
          requestBody: {
            categoryId: "c21",
            priority: "Normal",
            rescanNote: null,
          },
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/requests/D25/approve",
          requestBody: {
            categoryId: "c21",
            priority: "Normal",
            rescanNote: null,
          },
          compare: "body",
        },
      ],
    },
  ],
} as const;
