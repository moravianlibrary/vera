import { describe, expect, test } from "bun:test";
import { servedBatches } from "./batches";
import type { Request } from "./entities";
import type { RecordStore } from "./store";

describe("record store", () => {
  test("serves batches sized by their requests", () => {
    const store: RecordStore = {
      today: new Date("2026-01-01"),
      catalogPropertyKeys: new Set(),
      roles: [],
      users: [],
      groups: [],
      categories: [],
      projects: [],
      batches: [
        { id: "b1", name: "One", submittedBy: "u1", submittedAt: "2026-01-01T00:00:00Z" },
        { id: "b2", name: "Two", submittedBy: "u1", submittedAt: "2026-01-01T00:00:00Z" },
      ],
      requestCustodies: [],
      documents: [],
      iterations: [],
      requests: ["b1", "b2", "b2"].map(
        (batchId, index): Request => ({
          id: `r${index + 1}`,
          documentId: `d${index + 1}`,
          requesterId: "u1",
          at: "2026-01-01T00:00:00Z",
          reason: null,
          batchId,
          projectId: null,
          existingCopies: [],
          checkedAt: null,
          decision: "Pending",
          isAfterProjectApproval: false,
        }),
      ),
      statusLog: [],
      propertyDefinitions: [],
    };
    expect(servedBatches(store).map(({ id, size }) => ({ id, size }))).toEqual([
      { id: "b1", size: 1 },
      { id: "b2", size: 2 },
    ]);
  });
});
