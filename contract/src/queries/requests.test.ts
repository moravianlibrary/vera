import { describe, expect, test } from "bun:test";
import type { Document, Request, Session } from "@vera/domain/entities";
import type { RecordStore } from "@vera/domain/store";
import { findReachableRow, openProposalRows, type RequestPlugins } from "./requests";

const document = (id: string): Document => ({
  id,
  catalogId: id,
  unit: null,
  title: id,
  type: "Monograph",
  shelfMark: null,
  pageSources: [],
  registryRecords: [],
  properties: [],
});

const ask = (id: string, documentId: string, at: string): Request => ({
  id,
  documentId,
  requesterId: "reader",
  at,
  reason: null,
  batchId: `B-${id}`,
  projectId: null,
  existingCopies: [],
  checkedAt: at,
  decision: "Pending",
  isAfterProjectApproval: false,
});

function store(): RecordStore {
  return {
    today: new Date("2026-01-01"),
    catalogPropertyKeys: new Set(),
    users: [{ id: "reader", name: "Reader", kind: "person", email: null }],
    groups: [],
    categories: [],
    projects: [],
    batches: [],
    requestCustodies: [
      {
        id: "c1",
        name: "First",
        description: "",
        isFallback: false,
        memberIds: ["reader"],
        groupIds: [],
      },
      { id: "c2", name: "Other", description: "", isFallback: false, memberIds: [], groupIds: [] },
      {
        id: "fallback",
        name: "Fallback",
        description: "",
        isFallback: true,
        memberIds: [],
        groupIds: [],
      },
    ],
    documents: [document("d1"), document("d2")],
    iterations: [],
    requests: [
      ask("r-old", "d1", "2025-01-01T00:00:00Z"),
      ask("r-new", "d1", "2025-02-01T00:00:00Z"),
      ask("r-other", "d2", "2025-03-01T00:00:00Z"),
    ],
    statusLog: [],
    propertyDefinitions: [],
  };
}

const plugins: RequestPlugins = {
  placementsOf: (request) => (request.id === "r-other" ? ["c2"] : ["c1"]),
  suggestionFor: () => null,
};
const member: Session = {
  user: { id: "reader", name: "Reader", kind: "person", email: null },
  roleIds: [],
  grants: [{ permission: "request.read", scope: "custody" }],
  custodyCategoryIds: [],
  groupIds: [],
};

describe("Requests queries", () => {
  test("a custody member reaches rows placed in their custody only", () => {
    const records = store();
    expect(findReachableRow(records, plugins, member, "d1")?.custodyIds).toEqual(["c1"]);
    expect(findReachableRow(records, plugins, member, "d2")).toBeNull();
  });

  test("the fallback custody takes a row no rule placed", () => {
    const records = store();
    const noPlacement: RequestPlugins = { ...plugins, placementsOf: () => [] };
    expect(
      openProposalRows(records, noPlacement).find((row) => row.record.document.id === "d1")
        ?.custodyIds,
    ).toEqual(["fallback"]);
  });

  test("one decision row per document gathers its open asks oldest first", () => {
    const rows = openProposalRows(store(), plugins);
    expect(rows).toHaveLength(2);
    expect(
      rows.find((row) => row.record.document.id === "d1")?.record.requests.map(({ id }) => id),
    ).toEqual(["r-old", "r-new"]);
  });
});
