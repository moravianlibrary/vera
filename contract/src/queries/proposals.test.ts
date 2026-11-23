import { describe, expect, test } from "bun:test";
import type { CatalogRecord } from "@vera/domain/catalog";
import type { Document, Request, Session } from "@vera/domain/entities";
import type { RecordStore } from "@vera/domain/store";
import type { ProposalPlugins } from "./proposals";
import { checkItem, getRateLimitStatus, planSubmission } from "./proposals";

const session = {
  user: { id: "u1", name: "Reader", kind: "person", email: null },
  roleIds: ["reader"],
  groupIds: [],
  grants: [],
  custodyCategoryIds: [],
} as Session;
const doc = (id: string, catalogId: string): Document =>
  ({
    id,
    catalogId,
    title: "Title",
    type: "Monograph",
    shelfMark: null,
    unit: null,
    pageSources: [],
    registryRecords: [],
    properties: [],
  }) as Document;
const request = (
  id: string,
  documentId: string,
  requesterId: string,
  at = "2026-07-02T00:00:00Z",
): Request =>
  ({
    id,
    documentId,
    requesterId,
    at,
    reason: null,
    batchId: "B-0001",
    projectId: null,
    existingCopies: [],
    checkedAt: at,
    decision: "Pending",
    isAfterProjectApproval: false,
  }) as Request;
const record = (catalogId: string, fields: Partial<CatalogRecord> = {}): CatalogRecord => ({
  catalogId,
  title: "Title",
  type: "Monograph",
  units: null,
  identifiers: [],
  shelfMarks: {},
  barcodes: {},
  ...fields,
});
const plugins = (
  records: CatalogRecord[],
  answers: ProposalPlugins["registryLookup"] = () => [],
): ProposalPlugins => ({
  catalogRecords: () => records,
  registryLookup: answers,
  catalogPropertyValuesOf: () => [],
  waysIn: () => ({
    canDetectTypes: false,
    searchCatalogs: [],
    linkCatalogs: [],
    entrySources: [],
    canScanWithCamera: false,
    photoReaders: [],
    identifierTypes: [],
  }),
});
const store = (overrides: Partial<RecordStore> = {}): RecordStore => ({
  today: new Date("2026-07-02T12:00:00Z"),
  catalogPropertyKeys: new Set(),
  users: [],
  roles: [
    {
      id: "reader",
      proposalBatchLimit: 10,
      proposalDailyLimit: 100,
      grants: [{ permission: "request.create", scope: "own" }],
    },
  ] as never,
  groups: [],
  categories: [],
  projects: [],
  batches: [],
  requestCustodies: [],
  documents: [],
  iterations: [],
  requests: [],
  statusLog: [],
  propertyDefinitions: [],
  ...overrides,
});

describe("shared proposal checks", () => {
  test("previews registry copies for a new document at the supplied moment", () => {
    const now = new Date("2026-07-02T12:00:00Z");
    const check = checkItem(
      store(),
      plugins([record("NEW")], () => [
        { registry: "Kramerius", state: "Published", link: "https://example.org/scan" },
      ]),
      session,
      { type: "catalogId", value: "NEW", unit: null },
      true,
      now,
    );
    expect(check).toMatchObject({
      kind: "new",
      preview: {
        copies: [{ source: "Kramerius", state: "Published", link: "https://example.org/scan" }],
      },
    });
  });
  test("answers new, mine, inVera, whichUnit, whichRecord and notInCatalog", () => {
    const held = doc("D1", "MINE");
    const current = store({ documents: [held], requests: [request("R1", "D1", "u1")] });
    expect(
      checkItem(store(), plugins([record("NEW")]), session, {
        type: "catalogId",
        value: "NEW",
        unit: null,
      }),
    ).toMatchObject({ kind: "new" });
    expect(
      checkItem(current, plugins([record("MINE")]), session, {
        type: "catalogId",
        value: "MINE",
        unit: null,
      }),
    ).toMatchObject({ kind: "mine" });
    expect(
      checkItem(
        store({ documents: [held], requests: [request("R2", "D1", "u2")] }),
        plugins([record("MINE")]),
        session,
        { type: "catalogId", value: "MINE", unit: null },
      ),
    ).toMatchObject({ kind: "inVera" });
    expect(
      checkItem(store(), plugins([record("UNIT", { units: ["1", "2"] })]), session, {
        type: "catalogId",
        value: "UNIT",
        unit: null,
      }),
    ).toMatchObject({ kind: "whichUnit" });
    expect(
      checkItem(
        store(),
        plugins([
          record("A", { shelfMarks: { SHARED: null } }),
          record("B", { shelfMarks: { SHARED: null } }),
        ]),
        session,
        { type: "shelfMark", value: "SHARED", unit: null },
      ),
    ).toMatchObject({ kind: "whichRecord" });
    expect(
      checkItem(store(), plugins([]), session, { type: "catalogId", value: "UNKNOWN", unit: null }),
    ).toEqual({ kind: "notInCatalog" });
  });
});

describe("library day count and submission plan", () => {
  test("counts requests on the Prague day in summer and winter", () => {
    const s = store({
      requests: [
        request("R1", "D1", "u1", "2026-07-01T22:30:00Z"),
        request("R2", "D1", "u1", "2026-01-01T23:30:00Z"),
      ],
    });
    expect(getRateLimitStatus(s, session, new Date("2026-07-02T12:00:00Z")).perDay).toBe(99);
    expect(getRateLimitStatus(s, session, new Date("2026-01-02T12:00:00Z")).perDay).toBe(99);
  });

  test("holds an approved request for its check and orders the events with one correlation ID", () => {
    const result = planSubmission(
      store(),
      plugins([record("NEW")]),
      session,
      {
        items: [{ type: "catalogId", value: "NEW", unit: null, reason: null }],
        reason: null,
        projectId: null,
        batchName: null,
        approval: { categoryId: "c1", priority: "Normal" },
        entrySourceId: null,
      },
      new Date("2026-07-02T12:00:00Z"),
      (prefix) => `${prefix}-1`,
    );
    expect(result.writes).toMatchObject({
      documents: [{ catalogId: "NEW" }],
      iterations: [],
      requests: [
        {
          id: "R-1",
          decision: "Pending",
          checkedAt: null,
          existingCopies: [],
          approvalAfterCheck: { categoryId: "c1", priority: "Normal" },
        },
      ],
    });
    expect(result.writes.batch?.id).toBe("B-0001");
    expect(result.writes.events.map(({ code }) => code)).toEqual([
      "request.created",
      "request.held",
    ]);
    expect(new Set(result.writes.events.map(({ correlationId }) => correlationId)).size).toBe(1);
    expect(result.report).toMatchObject({ proposed: 1, approved: 0 });
  });

  test("uses the first planned document for a second item with the same identity", () => {
    let id = 0;
    const result = planSubmission(
      store(),
      plugins([record("NEW")]),
      session,
      {
        items: [
          { type: "catalogId", value: "NEW", unit: null, reason: null },
          { type: "catalogId", value: "NEW", unit: null, reason: null },
        ],
        reason: null,
        projectId: null,
        batchName: null,
        approval: null,
        entrySourceId: null,
      },
      new Date("2026-07-02T12:00:00Z"),
      (prefix) => `${prefix}-${++id}`,
    );

    expect(result.writes.documents).toHaveLength(1);
    expect(result.writes.requests).toHaveLength(2);
    expect(result.writes.requests.map(({ documentId }) => documentId)).toEqual([
      result.writes.documents[0]?.id,
      result.writes.documents[0]?.id,
    ]);
  });

  test("plans no writes when every item is skipped", () => {
    const result = planSubmission(
      store(),
      plugins([]),
      session,
      {
        items: [{ type: "catalogId", value: "UNKNOWN", unit: null, reason: null }],
        reason: null,
        projectId: null,
        batchName: null,
        approval: null,
        entrySourceId: null,
      },
      new Date("2026-07-02T12:00:00Z"),
      (prefix) => `${prefix}-1`,
    );
    expect(result.writes).toEqual({
      batch: null,
      documents: [],
      iterations: [],
      requests: [],
      events: [],
    });
  });
});
