import { describe, expect, test } from "bun:test";
import type { Document, Request } from "@vera/domain/entities";
import type { RecordStore } from "@vera/domain/store";
import { custodyImpactOf, custodyRecordOf, openProposalCountsByCustody } from "./custodies";
import type { RequestPlugins } from "./requests";

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
const request = (id: string, documentId: string): Request => ({
  id,
  documentId,
  requesterId: "u1",
  at: "2026-01-01T00:00:00Z",
  reason: null,
  batchId: "b1",
  projectId: null,
  existingCopies: [],
  checkedAt: "2026-01-01T00:00:00Z",
  decision: "Pending",
  isAfterProjectApproval: false,
});
const store: RecordStore = {
  today: new Date("2026-01-01"),
  catalogPropertyKeys: new Set(),
  users: [],
  roles: [],
  groups: [],
  categories: [],
  projects: [],
  batches: [],
  requestCustodies: [
    {
      id: "c1",
      name: "One",
      names: { en: "One" },
      description: "",
      isFallback: false,
      memberIds: [],
      groupIds: [],
    },
    {
      id: "c2",
      name: "Two",
      names: { en: "Two" },
      description: "",
      isFallback: false,
      memberIds: [],
      groupIds: [],
    },
    {
      id: "fallback",
      name: "Fallback",
      names: { en: "Fallback" },
      description: "",
      isFallback: true,
      memberIds: [],
      groupIds: [],
    },
  ],
  documents: [document("d1"), document("d2"), document("d3")],
  iterations: [],
  requests: [request("r1", "d1"), request("r2", "d2"), request("r3", "d3")],
  statusLog: [],
  propertyDefinitions: [],
};
const plugins: RequestPlugins = {
  placementsOf: (ask) => (ask.id === "r1" ? ["c1", "c2"] : ask.id === "r2" ? ["c1"] : []),
  suggestionFor: () => null,
};

describe("custody queries", () => {
  test("counts open proposals, reports placement rules and counts only exclusive fallback moves", () => {
    const counts = openProposalCountsByCustody(store, plugins);
    expect(counts).toEqual(
      new Map([
        ["c1", 2],
        ["c2", 1],
        ["fallback", 1],
      ]),
    );
    const fallback = store.requestCustodies.find((custody) => custody.isFallback);
    expect(
      fallback &&
        custodyRecordOf(fallback, counts, [{ instanceId: "plugin-3", custodyId: "fallback" }])
          .placedByIds,
    ).toEqual([]);
    expect(
      custodyImpactOf(store, plugins, "c1", [
        { instanceId: "plugin-1", custodyId: "c1" },
        { instanceId: "plugin-2", custodyId: "c2" },
      ]),
    ).toEqual({ openCount: 2, toFallbackCount: 1, ruleIds: ["plugin-1"] });
    expect(custodyImpactOf(store, plugins, "fallback", [])).toEqual({
      openCount: 1,
      toFallbackCount: 1,
      ruleIds: [],
    });
  });
});
