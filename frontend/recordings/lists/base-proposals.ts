export default {
  seed: "base",
  moment: "2026-06-25T08:40:00.000Z",
  mask: "proposals",
  scenarios: [
    {
      name: "u3",
      calls: [
        {
          as: "admin",
          method: "GET",
          path: "/api/proposals/settings",
          compare: "body",
        },
        {
          as: "admin",
          method: "GET",
          path: "/api/proposals/rate-limit",
          compare: "body",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/proposals/lookup",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1939",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1936–1938",
              },
              {
                type: "catalogId",
                value: "MZK03-000556300",
                unit: "1902",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: null,
              },
              {
                type: "shelfMark",
                value: "ST3-0880",
                unit: null,
              },
              {
                type: "catalogId",
                value: "not-in-catalog",
                unit: null,
              },
            ],
          },
          compare: "body",
        },
        {
          as: "admin",
          method: "GET",
          path: "/api/proposals/catalog-search?q=Moravsk%C3%A9",
          compare: "body",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "https://vufind.mzk.cz/Record/MZK01-001277001",
          },
          compare: "body",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "not a catalog record",
          },
          compare: "body",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/proposals/barcode",
          form: {
            photo: {
              photoBytes: 0,
            },
          },
          compare: "body",
        },
      ],
    },
    {
      name: "u8",
      calls: [
        {
          as: "curator",
          method: "GET",
          path: "/api/proposals/settings",
          compare: "body",
        },
        {
          as: "curator",
          method: "GET",
          path: "/api/proposals/rate-limit",
          compare: "body",
        },
        {
          as: "curator",
          method: "POST",
          path: "/api/proposals/lookup",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1939",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1936–1938",
              },
              {
                type: "catalogId",
                value: "MZK03-000556300",
                unit: "1902",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: null,
              },
              {
                type: "shelfMark",
                value: "ST3-0880",
                unit: null,
              },
              {
                type: "catalogId",
                value: "not-in-catalog",
                unit: null,
              },
            ],
          },
          compare: "body",
        },
        {
          as: "curator",
          method: "GET",
          path: "/api/proposals/catalog-search?q=Moravsk%C3%A9",
          compare: "body",
        },
        {
          as: "curator",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "https://vufind.mzk.cz/Record/MZK01-001277001",
          },
          compare: "body",
        },
        {
          as: "curator",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "not a catalog record",
          },
          compare: "body",
        },
        {
          as: "curator",
          method: "POST",
          path: "/api/proposals/barcode",
          form: {
            photo: {
              photoBytes: 0,
            },
          },
          compare: "body",
        },
      ],
    },
    {
      name: "u2",
      calls: [
        {
          as: "digitization",
          method: "GET",
          path: "/api/proposals/settings",
          compare: "body",
        },
        {
          as: "digitization",
          method: "GET",
          path: "/api/proposals/rate-limit",
          compare: "body",
        },
        {
          as: "digitization",
          method: "POST",
          path: "/api/proposals/lookup",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1939",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1936–1938",
              },
              {
                type: "catalogId",
                value: "MZK03-000556300",
                unit: "1902",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: null,
              },
              {
                type: "shelfMark",
                value: "ST3-0880",
                unit: null,
              },
              {
                type: "catalogId",
                value: "not-in-catalog",
                unit: null,
              },
            ],
          },
          compare: "body",
        },
        {
          as: "digitization",
          method: "GET",
          path: "/api/proposals/catalog-search?q=Moravsk%C3%A9",
          compare: "body",
        },
        {
          as: "digitization",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "https://vufind.mzk.cz/Record/MZK01-001277001",
          },
          compare: "body",
        },
        {
          as: "digitization",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "not a catalog record",
          },
          compare: "body",
        },
        {
          as: "digitization",
          method: "POST",
          path: "/api/proposals/barcode",
          form: {
            photo: {
              photoBytes: 0,
            },
          },
          compare: "body",
        },
      ],
    },
    {
      name: "u4",
      calls: [
        {
          as: "staff",
          method: "GET",
          path: "/api/proposals/settings",
          compare: "body",
        },
        {
          as: "staff",
          method: "GET",
          path: "/api/proposals/rate-limit",
          compare: "body",
        },
        {
          as: "staff",
          method: "POST",
          path: "/api/proposals/lookup",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1939",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1936–1938",
              },
              {
                type: "catalogId",
                value: "MZK03-000556300",
                unit: "1902",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: null,
              },
              {
                type: "shelfMark",
                value: "ST3-0880",
                unit: null,
              },
              {
                type: "catalogId",
                value: "not-in-catalog",
                unit: null,
              },
            ],
          },
          compare: "body",
        },
        {
          as: "staff",
          method: "GET",
          path: "/api/proposals/catalog-search?q=Moravsk%C3%A9",
          compare: "body",
        },
        {
          as: "staff",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "https://vufind.mzk.cz/Record/MZK01-001277001",
          },
          compare: "body",
        },
        {
          as: "staff",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "not a catalog record",
          },
          compare: "body",
        },
        {
          as: "staff",
          method: "POST",
          path: "/api/proposals/barcode",
          form: {
            photo: {
              photoBytes: 0,
            },
          },
          compare: "body",
        },
      ],
    },
    {
      name: "u5",
      calls: [
        {
          as: "reader",
          method: "GET",
          path: "/api/proposals/settings",
          compare: "body",
        },
        {
          as: "reader",
          method: "GET",
          path: "/api/proposals/rate-limit",
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals/lookup",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1939",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1936–1938",
              },
              {
                type: "catalogId",
                value: "MZK03-000556300",
                unit: "1902",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: null,
              },
              {
                type: "shelfMark",
                value: "ST3-0880",
                unit: null,
              },
              {
                type: "catalogId",
                value: "not-in-catalog",
                unit: null,
              },
            ],
          },
          compare: "body",
        },
        {
          as: "reader",
          method: "GET",
          path: "/api/proposals/catalog-search?q=Moravsk%C3%A9",
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "https://vufind.mzk.cz/Record/MZK01-001277001",
          },
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "not a catalog record",
          },
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals/barcode",
          form: {
            photo: {
              photoBytes: 0,
            },
          },
          compare: "body",
        },
      ],
    },
    {
      name: "u10",
      calls: [
        {
          as: "no-access",
          method: "GET",
          path: "/api/proposals/settings",
          compare: "body",
        },
        {
          as: "no-access",
          method: "GET",
          path: "/api/proposals/rate-limit",
          compare: "body",
        },
        {
          as: "no-access",
          method: "POST",
          path: "/api/proposals/lookup",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1939",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1936–1938",
              },
              {
                type: "catalogId",
                value: "MZK03-000556300",
                unit: "1902",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: null,
              },
              {
                type: "shelfMark",
                value: "ST3-0880",
                unit: null,
              },
              {
                type: "catalogId",
                value: "not-in-catalog",
                unit: null,
              },
            ],
          },
          compare: "body",
        },
        {
          as: "no-access",
          method: "GET",
          path: "/api/proposals/catalog-search?q=Moravsk%C3%A9",
          compare: "body",
        },
        {
          as: "no-access",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "https://vufind.mzk.cz/Record/MZK01-001277001",
          },
          compare: "body",
        },
        {
          as: "no-access",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "not a catalog record",
          },
          compare: "body",
        },
        {
          as: "no-access",
          method: "POST",
          path: "/api/proposals/barcode",
          form: {
            photo: {
              photoBytes: 0,
            },
          },
          compare: "body",
        },
      ],
    },
    {
      name: "u9",
      calls: [
        {
          as: "project-user",
          method: "GET",
          path: "/api/proposals/settings",
          compare: "body",
        },
        {
          as: "project-user",
          method: "GET",
          path: "/api/proposals/rate-limit",
          compare: "body",
        },
        {
          as: "project-user",
          method: "POST",
          path: "/api/proposals/lookup",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1939",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1936–1938",
              },
              {
                type: "catalogId",
                value: "MZK03-000556300",
                unit: "1902",
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: null,
              },
              {
                type: "shelfMark",
                value: "ST3-0880",
                unit: null,
              },
              {
                type: "catalogId",
                value: "not-in-catalog",
                unit: null,
              },
            ],
          },
          compare: "body",
        },
        {
          as: "project-user",
          method: "GET",
          path: "/api/proposals/catalog-search?q=Moravsk%C3%A9",
          compare: "body",
        },
        {
          as: "project-user",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "https://vufind.mzk.cz/Record/MZK01-001277001",
          },
          compare: "body",
        },
        {
          as: "project-user",
          method: "POST",
          path: "/api/proposals/record-link",
          requestBody: {
            catalogInstanceId: "pi1",
            link: "not a catalog record",
          },
          compare: "body",
        },
        {
          as: "project-user",
          method: "POST",
          path: "/api/proposals/barcode",
          form: {
            photo: {
              photoBytes: 0,
            },
          },
          compare: "body",
        },
      ],
    },
    {
      name: "a-reader-then-admin-and-reader-pages",
      calls: [
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1940",
                reason: null,
              },
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1936–1938",
                reason: null,
              },
              {
                type: "catalogId",
                value: "MZK03-000556300",
                unit: "1902",
                reason: null,
              },
            ],
            reason: null,
            projectId: null,
            batchName: null,
            approval: null,
            entrySourceId: null,
          },
          compare: "body",
        },
        {
          as: "admin",
          method: "GET",
          path: "/api/requests",
          compare: "body",
        },
        {
          as: "admin",
          method: "GET",
          path: "/api/requests/$NEW_DOCUMENT",
          compare: "body",
        },
        {
          as: "reader",
          method: "GET",
          path: "/api/documents?perspective=my",
          compare: "body",
        },
      ],
    },
    {
      name: "b-admin-approve-now",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/proposals",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1940",
                reason: null,
              },
            ],
            reason: null,
            projectId: null,
            batchName: null,
            approval: {
              categoryId: "c21",
              priority: "Normal",
            },
            entrySourceId: null,
          },
          compare: "body",
        },
        {
          as: "admin",
          method: "GET",
          path: "/api/documents/$NEW_DOCUMENT",
          compare: "body",
        },
      ],
    },
    {
      name: "c-project-user-project-custody",
      calls: [
        {
          as: "project-user",
          method: "POST",
          path: "/api/proposals",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1940",
                reason: null,
              },
            ],
            reason: null,
            projectId: "p1",
            batchName: null,
            approval: null,
            entrySourceId: null,
          },
          compare: "body",
        },
        {
          as: "digitization",
          method: "GET",
          path: "/api/requests",
          compare: "body",
        },
      ],
    },
    {
      name: "proposal-refusal-codes",
      calls: [
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals",
          requestBody: {
            items: Array.from({ length: 11 }, () => ({
              type: "catalogId",
              value: "MZK01-001277001",
              unit: null,
              reason: null,
            })),
            reason: null,
            projectId: null,
            batchName: null,
            approval: null,
            entrySourceId: null,
          },
          compare: "code",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals",
          requestBody: {
            items: [
              {
                type: "catalogId",
                value: "MZK01-001277001",
                unit: "1939",
                reason: null,
              },
            ],
            reason: null,
            projectId: "p1",
            batchName: null,
            approval: null,
            entrySourceId: null,
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/plugin-instances/pi12/disable",
          requestBody: {},
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals/barcode",
          form: { photo: { photoBytes: 2, fileName: "barcode.jpg" } },
          compare: "code",
        },
      ],
    },
    {
      name: "proposal-daily-limit",
      calls: [
        {
          as: "admin",
          method: "PUT",
          path: "/api/access/roles/reader",
          requestBody: {
            name: "Reader",
            description: "Proposes and follows their own requests. Holds only self-scoped grants.",
            grants: [
              { permission: "request.create", scope: null },
              { permission: "request.read_mine", scope: null },
              { permission: "request.withdraw_own", scope: null },
              { permission: "watch", scope: null },
            ],
            proposalBatchLimit: 10,
            proposalDailyLimit: 2,
          },
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals",
          requestBody: {
            items: [
              { type: "catalogId", value: "MZK01-001277001", unit: "1940", reason: null },
              { type: "catalogId", value: "MZK01-001277001", unit: "1936–1938", reason: null },
            ],
            reason: null,
            projectId: null,
            batchName: null,
            approval: null,
            entrySourceId: null,
          },
          compare: "body",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/proposals",
          requestBody: {
            items: [{ type: "catalogId", value: "VKOL01-000456123", unit: "1941", reason: null }],
            reason: null,
            projectId: null,
            batchName: null,
            approval: null,
            entrySourceId: null,
          },
          compare: "code",
        },
      ],
    },
  ],
} as const;
