import { afterEach, describe, expect, it } from "vitest";
import { database, mockStore } from "@/mocks/database";
import {
  checkItem,
  mockProposalPlugins,
  runProposalChecks,
  submitProposal,
} from "@/mocks/proposals";
import { resolveSession } from "@/mocks/session";

const saved = {
  batches: structuredClone(database.batches),
  documents: structuredClone(database.documents),
  iterations: structuredClone(database.iterations),
  requests: structuredClone(database.requests),
  statusLog: structuredClone(database.statusLog),
  pending: [...database.pendingProposalChecks],
};
afterEach(() => {
  database.batches.splice(0, database.batches.length, ...structuredClone(saved.batches));
  database.documents.splice(0, database.documents.length, ...structuredClone(saved.documents));
  database.iterations.splice(0, database.iterations.length, ...structuredClone(saved.iterations));
  database.requests.splice(0, database.requests.length, ...structuredClone(saved.requests));
  database.statusLog.splice(0, database.statusLog.length, ...structuredClone(saved.statusLog));
  database.pendingProposalChecks.splice(0, database.pendingProposalChecks.length, ...saved.pending);
});

const item = { type: "catalogId" as const, value: "MZK01-001277001", unit: "1940" };
const itemWithCopy = { type: "catalogId" as const, value: "MZK01-001284756", unit: "1918–1925" };
const draft = (approval: { categoryId: string; priority: "Normal" } | null = null) => ({
  items: [{ ...item, reason: null }],
  reason: null,
  projectId: null,
  batchName: null,
  approval,
  entrySourceId: null,
});

describe("proposal checks", () => {
  it("keeps a new proposal unchecked until the jobs control runs", () => {
    const report = submitProposal(resolveSession("reader"), draft());
    const request = database.requests.find(({ batchId }) => batchId === report.batch?.id);
    expect(request?.checkedAt).toBeNull();
    expect(request?.existingCopies).toEqual([]);
    expect(runProposalChecks()).toEqual({ ran: 1, failed: 0 });
    expect(database.requests.find(({ id }) => id === request?.id)?.checkedAt).not.toBeNull();
  });

  it("records the registry answer and copy when a new item's check runs", () => {
    const report = submitProposal(resolveSession("reader"), {
      ...draft(),
      items: [{ type: "catalogId", value: "MZK01-001277001", unit: "1939", reason: null }],
    });
    const request = database.requests.find(({ batchId }) => batchId === report.batch?.id);
    expect(request?.existingCopies).toEqual([]);
    runProposalChecks();
    const checked = database.requests.find(({ id }) => id === request?.id);
    expect(checked?.existingCopies).toContainEqual(
      expect.objectContaining({ source: "Kramerius", state: "Published" }),
    );
    const document = database.documents.find(({ id }) => id === request?.documentId);
    expect(document?.registryRecords).toContainEqual(
      expect.objectContaining({ registry: "Kramerius", state: "Published" }),
    );
  });

  it("holds approve-now, then approves without a copy and leaves a rescan pending with one", () => {
    const report = submitProposal(
      resolveSession("admin"),
      draft({ categoryId: "c21", priority: "Normal" }),
    );
    const request = database.requests.find(({ batchId }) => batchId === report.batch?.id);
    expect(request?.decision).toBe("Pending");
    expect(
      database.statusLog.some(
        ({ code, data }) => code === "request.held" && data?.why === "checking",
      ),
    ).toBe(true);
    runProposalChecks();
    expect(database.requests.find(({ id }) => id === request?.id)?.decision).toBe("Approved");
  });

  it("keeps approve-now pending when its check finds an existing copy", () => {
    const report = submitProposal(resolveSession("admin"), {
      ...draft({ categoryId: "c21", priority: "Normal" }),
      items: [{ ...itemWithCopy, reason: null }],
    });
    const request = database.requests.find(({ batchId }) => batchId === report.batch?.id);
    expect(request?.decision).toBe("Pending");
    runProposalChecks();
    const checked = database.requests.find(({ id }) => id === request?.id);
    expect(checked?.decision).toBe("Pending");
    expect(checked?.existingCopies).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "VERA" })]),
    );
  });

  it("previews copies for readers and omits restriction findings", () => {
    const reader = checkItem(
      mockStore(),
      mockProposalPlugins,
      resolveSession("reader"),
      itemWithCopy,
    );
    expect(reader.kind).toBe("new");
    if (reader.kind === "new") {
      expect(reader.preview.copies).toContainEqual(
        expect.objectContaining({ source: "Kramerius" }),
      );
      expect(reader.preview).not.toHaveProperty("restrictions");
    }
    const staff = checkItem(
      mockStore(),
      mockProposalPlugins,
      resolveSession("admin"),
      itemWithCopy,
    );
    expect(staff.kind === "new" && staff.preview.restrictions).toEqual([]);
  });
});
