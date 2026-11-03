import { describe, expect, test } from "bun:test";
import type { Document, Iteration, Request, Session } from "@vera/domain/entities";
import type { RecordStore } from "@vera/domain/store";
import { findDocumentDetail, queryDocuments } from "./documents";

const document: Document = {
  id: "d1",
  catalogId: "D1",
  unit: null,
  title: "A document",
  type: "Monograph",
  shelfMark: null,
  pageSources: [],
  registryRecords: [],
  properties: [
    {
      key: "secret",
      sources: [
        {
          value: "staff",
          source: { kind: "hand" },
          tier: 1,
          observedAt: "2026-01-01T00:00:00Z",
          setBy: "staff",
        },
      ],
    },
  ],
};

const iteration: Iteration = {
  id: "i1",
  documentId: "d1",
  attempt: 1,
  requestId: "r1",
  categoryId: "c1",
  priority: "Normal",
  projectId: null,
  progress: "IngestFailed",
  listId: null,
  formerListName: null,
  restriction: null,
  restrictionOverride: null,
  cancellation: null,
  defects: [],
  verdicts: [],
  ingestFailure: { attempts: 1, error: "secret error" },
  digitizedAt: null,
  links: [],
  scanDpi: null,
  properties: [],
};

const request = (id: string, requesterId: string): Request => ({
  id,
  documentId: "d1",
  requesterId,
  at: "2026-01-01T00:00:00Z",
  reason: null,
  batchId: `b-${id}`,
  projectId: null,
  existingCopies: [],
  checkedAt: null,
  decision: "Approved",
  iteration: { relation: "Originates", id: "i1" },
  rescan: null,
});

function store(): RecordStore {
  return {
    today: new Date("2026-01-02"),
    catalogPropertyKeys: new Set(),
    users: [
      { id: "reader", name: "Reader", kind: "person", email: null },
      { id: "other", name: "Other", kind: "person", email: null },
      { id: "staff", name: "Staff", kind: "person", email: null },
    ],
    groups: [],
    categories: [{ id: "c1", name: "Category", parentId: null }],
    projects: [],
    batches: [],
    requestCustodies: [],
    documents: [document],
    iterations: [iteration],
    requests: [request("r1", "reader"), request("r2", "other")],
    statusLog: [],
    propertyDefinitions: [],
  };
}

const reader: Session = {
  user: { id: "reader", name: "Reader", kind: "person", email: null },
  roleIds: [],
  grants: [{ permission: "request.read_mine", scope: null }],
  custodyCategoryIds: [],
  groupIds: [],
};

const staff: Session = {
  user: { id: "staff", name: "Staff", kind: "person", email: null },
  roleIds: [],
  grants: [{ permission: "iteration.read", scope: "any" }],
  custodyCategoryIds: [],
  groupIds: [],
};

describe("Documents queries", () => {
  test("My Documents shows only the reader's asks on a document others asked for too", () => {
    const page = queryDocuments(store(), reader, {}, undefined, null, "public");
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.requests.map(({ requesterId }) => requesterId)).toEqual(["reader"]);
  });

  test("a public reader gets no staff property", () => {
    const page = queryDocuments(store(), reader, {}, undefined, null, "public");
    expect(page.items[0]?.document.properties).toEqual([]);
  });

  test("staff without request.read_ingest gets an ingest failure without its error", () => {
    const detail = findDocumentDetail(store(), staff, "d1");
    expect(detail?.record.iterations[0]?.ingestFailure).toEqual({ attempts: 1, error: null });
  });
});
