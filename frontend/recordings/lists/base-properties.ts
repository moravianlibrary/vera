const textDraft = {
  names: { en: "Archive note", cs: "Poznámka archivu" },
  visibility: "staff",
  type: { kind: "text" },
  isList: false,
  about: "document",
  handTier: 100,
} as const;

const enumDraft = {
  names: { en: "Archive status", cs: "Stav archivu" },
  visibility: "staff",
  type: {
    kind: "enum",
    values: [
      { value: "Open", names: { en: "Open", cs: "Otevřeno" } },
      { value: "Closed", names: { en: "Closed", cs: "Uzavřeno" } },
    ],
  },
  isList: false,
  about: "document",
  handTier: 100,
} as const;

const sizeDraft = {
  ...enumDraft,
  names: { en: "Size", cs: "Formát" },
  type: {
    kind: "enum",
    values: ["A5", "A4", "A3", "A2", "folio"].map((value) => ({
      value,
      names: { en: value, cs: value },
    })),
  },
} as const;

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
  mask: "decisions",
  scenarios: [
    {
      name: "reads",
      calls: profiles.map((as) => ({
        as,
        method: "GET",
        path: "/api/properties",
        compare: "body" as const,
      })),
    },
    {
      name: "create-text-property",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/properties",
          requestBody: { key: "archive_note", draft: textDraft },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/properties", compare: "body" },
      ],
    },
    {
      name: "create-enum-property",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/properties",
          requestBody: { key: "archive_status", draft: enumDraft },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/properties", compare: "body" },
      ],
    },
    {
      name: "property-create-refusals",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/properties",
          requestBody: { key: "size", draft: textDraft },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/properties",
          requestBody: {
            key: "duplicate_values",
            draft: {
              ...enumDraft,
              type: {
                kind: "enum",
                values: [
                  { value: "A", names: { en: "A", cs: "A" } },
                  { value: "A", names: { en: "Again", cs: "Znovu" } },
                ],
              },
            },
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "POST",
          path: "/api/properties",
          requestBody: { key: "title", draft: { ...textDraft, handTier: 100 } },
          compare: "code",
        },
        {
          as: "reader",
          method: "POST",
          path: "/api/properties",
          requestBody: { key: "reader_note", draft: textDraft },
          compare: "code",
        },
      ],
    },
    {
      name: "save-property",
      calls: [
        {
          as: "admin",
          method: "PUT",
          path: "/api/properties/size",
          requestBody: { ...sizeDraft, names: { en: "Size of document", cs: "Formát dokumentu" } },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/properties", compare: "body" },
      ],
    },
    {
      name: "property-save-refusals",
      calls: [
        {
          as: "admin",
          method: "PUT",
          path: "/api/properties/size",
          requestBody: { ...textDraft, type: { kind: "text" } },
          compare: "code",
        },
        {
          as: "admin",
          method: "PUT",
          path: "/api/properties/size",
          requestBody: {
            ...enumDraft,
            type: { kind: "enum", values: [{ value: "A2", names: { en: "A2", cs: "A2" } }] },
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "PUT",
          path: "/api/properties/size",
          requestBody: {
            ...enumDraft,
            type: {
              kind: "enum",
              values: [
                { value: "A", names: { en: "A", cs: "A" } },
                { value: "A", names: { en: "Again", cs: "Znovu" } },
              ],
            },
          },
          compare: "code",
        },
        {
          as: "admin",
          method: "PUT",
          path: "/api/properties/title",
          requestBody: { ...textDraft, handTier: 100 },
          compare: "code",
        },
      ],
    },
    {
      name: "property-impact-and-delete",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/properties",
          requestBody: { key: "archive_note", draft: textDraft },
          compare: "body",
        },
        {
          as: "admin",
          method: "GET",
          path: "/api/properties/archive_note/impact",
          compare: "body",
        },
        { as: "admin", method: "DELETE", path: "/api/properties/archive_note", compare: "body" },
        { as: "admin", method: "GET", path: "/api/properties", compare: "body" },
      ],
    },
    {
      name: "property-delete-refusal",
      calls: [{ as: "admin", method: "DELETE", path: "/api/properties/title", compare: "code" }],
    },
    {
      name: "enter-property-value",
      calls: [
        {
          as: "admin",
          method: "PUT",
          path: "/api/documents/D1/properties/size",
          requestBody: { value: "A3" },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/documents/D1", compare: "body" },
      ],
    },
    {
      name: "enter-property-values",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/documents/properties/size",
          requestBody: { value: "A4", documentIds: ["D2", "D3"] },
          compare: "body",
        },
        { as: "admin", method: "GET", path: "/api/documents?perspective=all", compare: "body" },
      ],
    },
    {
      name: "property-entry-refusals",
      calls: [
        {
          as: "admin",
          method: "PUT",
          path: "/api/documents/D1/properties/title",
          requestBody: { value: "A hand title" },
          compare: "code",
        },
        {
          as: "admin",
          method: "PUT",
          path: "/api/documents/D1/properties/size",
          requestBody: { value: "not-a-size" },
          compare: "code",
        },
        {
          as: "admin",
          method: "PUT",
          path: "/api/documents/D20/properties/machines",
          requestBody: { value: ["bookeye"] },
          compare: "code",
        },
        {
          as: "admin",
          method: "PUT",
          path: "/api/documents/D1/properties/machines",
          requestBody: { value: ["bookeye"] },
          compare: "code",
        },
      ],
    },
    {
      name: "bulk-property-entry-refusals",
      calls: [
        {
          as: "admin",
          method: "POST",
          path: "/api/documents/properties/machines",
          requestBody: { value: ["bookeye"], documentIds: ["D20", "D1"] },
          compare: "body",
        },
      ],
    },
  ],
} as const;
