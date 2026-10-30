// Requests end to end against the mock server over HTTP: whose proposals each decider
// sees, one row and one decision per document, what a rescan, a decline and a bulk approve
// need, and what is refused. Decisions change the mock's state, so each test decides its own
// documents.

import type { RequestQuery } from "@vera/contract/requests";
import {
  isSameRequestQuery,
  maximumRequestSliceSize,
  parseRequestSearchParams,
  toRequestSearchParams,
} from "@vera/contract/requests";
import { isLegacyEntry } from "@vera/domain/entities";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { findDocument } from "@/api/documents";
import { ApiError } from "@/api/http";
import {
  approveProposal,
  bulkApproveProposals,
  declineProposal,
  findRequest,
  listRequests,
  withdrawAsk,
} from "@/api/requests";
import type { MockUserProfile } from "@/config/env";
import { database } from "@/mocks/database";
import { documents } from "@/mocks/fixtures/documents";
import { requests } from "@/mocks/fixtures/requests";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function statusOf(call: Promise<unknown>): Promise<number | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.status : null;
  }
}

// A harvest of `size` open proposals in a batch of its own, each a copy of D25's ask, which its
// custody placement follows.
function harvest(batchId: string, size: number): void {
  // The fixtures as they were, before any test decided them.
  const document = documents.find(({ id }) => id === "D25");
  const ask = requests.find(({ id }) => id === "R28");
  if (document === undefined || ask === undefined) {
    throw new Error("D25 and its ask R28 are fixtures");
  }

  database.batches.push({
    id: batchId,
    name: "ISSN harvest",
    submittedBy: "a2",
    submittedAt: "2026-06-25T06:00:00Z",
  });
  for (let index = 1; index <= size; index += 1) {
    const documentId = `D25.${9000 + index}`;
    database.documents.push({ ...document, id: documentId });
    database.requests.push({ ...ask, id: `R28.${9000 + index}`, documentId, batchId });
  }
}

async function documentIdsOf(query: RequestQuery = {}): Promise<string[]> {
  const page = await listRequests(query, { limit: 200 });
  return page.items.map((row) => row.record.document.id);
}

describe("the query", () => {
  it("writes every decision it names, and none for any", () => {
    expect(toRequestSearchParams({ decisions: ["Pending"] }).toString()).toBe("decision=Pending");
    expect(parseRequestSearchParams(new URLSearchParams("")).decisions).toBeUndefined();
    expect(
      isSameRequestQuery(
        { decisions: ["Withdrawn", "Denied"] },
        { decisions: ["Denied", "Withdrawn"] },
      ),
    ).toBe(true);
    expect(isSameRequestQuery({}, { decisions: ["Pending"] })).toBe(false);
  });

  it("writes the days asked as a range with either end open, and drops a malformed one", () => {
    expect(toRequestSearchParams({ asked: { from: "2026-06-01" } }).toString()).toBe(
      "asked=2026-06-01..",
    );
    expect(parseRequestSearchParams(new URLSearchParams("asked=..2026-06-21")).asked).toEqual({
      to: "2026-06-21",
    });
    expect(parseRequestSearchParams(new URLSearchParams("asked=2026-13-01..")).asked).toBe(
      undefined,
    );
  });
});

describe("listRequests", () => {
  it("filters requests by their batch source", async () => {
    signInAs("admin");
    const batchesBefore = [...database.batches];
    const documentsBefore = [...database.documents];
    const requestsBefore = [...database.requests];
    harvest("B-SOURCE", 1);
    database.batches = database.batches.map((batch) =>
      batch.id === "B-SOURCE"
        ? { ...batch, source: { instanceId: "pi43", name: "Tlačítko digitalizovat" } }
        : batch,
    );
    try {
      const all = await listRequests({}, { limit: 200 });
      const filtered = await listRequests({ sources: ["pi43"] }, { limit: 200 });
      expect(filtered.items.length).toBeGreaterThan(0);
      expect(filtered.items.length).toBeLessThan(all.items.length);
      expect(filtered.items.some(({ record }) => record.document.id === "D25.9001")).toBe(true);
      expect(toRequestSearchParams({ sources: ["pi43"] }).get("source")).toBe("pi43");
    } finally {
      database.batches = batchesBefore;
      database.documents = documentsBefore;
      database.requests = requestsBefore;
    }
  });

  it("shows an admin every open proposal, the fallback's included, one row per document", async () => {
    signInAs("admin");

    const page = await listRequests({ decisions: ["Pending"] }, { limit: 200 });
    const ids = page.items.map((row) => row.record.document.id);

    expect(ids).toContain("D31");
    expect(ids.filter((id) => id === "D20")).toHaveLength(1);
    expect(
      page.items.find((row) => row.record.document.id === "D20")?.record.requests,
    ).toHaveLength(4);
    expect(page.items.every((row) => row.decision === "Pending")).toBe(true);
  });

  it("shows a curator the requests in their request custody, and lets them decide those (VIEW-requests)", async () => {
    signInAs("curator");

    const page = await listRequests({}, { limit: 200 });
    const open = page.items.find((row) => row.decision === "Pending");

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((row) => row.custodyIds.includes("pc1"))).toBe(true);
    expect(page.items.map((row) => row.record.document.id)).not.toContain("D31");
    expect(page.facets.custodyIds.map((facet) => facet.value)).not.toContain("pc0");
    expect(open && (await findRequest(open.record.document.id))?.canDecide).toBe(true);
  });

  it("shows every decision unfiltered, and only the open ones awaiting a decision", async () => {
    signInAs("admin");

    expect(await documentIdsOf()).toEqual(expect.arrayContaining(["D20", "D23", "D24"]));
    expect(await documentIdsOf({ decisions: ["Pending"] })).not.toContain("D23");
    expect(await documentIdsOf({ decisions: ["Denied"] })).toEqual(["D23", "D29"]);
    expect(await documentIdsOf({ decisions: ["Withdrawn"] })).toEqual(["D24"]);
  });

  it("lists a row in the batch of its earliest ask, and says what a bulk approve would take", async () => {
    signInAs("admin");

    const page = await listRequests({}, { grouping: "batch", limit: 200 });
    const shelf = page.groups.find(
      (group) => group.kind === "batch" && group.batch?.id === "B-0143",
    );

    expect(shelf).toMatchObject({ elsewhereCount: 1, rescanCount: 1 });
    expect(shelf?.kind === "batch" && shelf.approvableCount).toBe(4);
  });

  it("opens each row on the first classifier's leaf, once the checks have answered", async () => {
    signInAs("admin");

    const regional = await findRequest("D25");
    const national = await findRequest("D20");

    expect(regional?.row.suggestion).toEqual({
      categoryId: "c21",
      reason: "Periodical, Moravian place of publication",
      classifier: { id: "pi30", name: "Regional press" },
    });
    expect(national?.row.suggestion).toMatchObject({
      categoryId: "c22",
      classifier: { name: "Material type" },
    });
    expect((await findRequest("D22"))?.row.suggestion).toBeNull(); // a monograph: no rule
    expect((await findRequest("D21"))?.row.suggestion).toBeNull(); // still being checked
  });

  it("counts what a batch's classifiers suggested over what a bulk approve takes", async () => {
    signInAs("admin");

    const page = await listRequests({}, { grouping: "batch", limit: 200 });
    const shelf = page.groups.find(
      (group) => group.kind === "batch" && group.batch?.id === "B-0143",
    );

    expect(shelf?.kind === "batch" && shelf.suggestedCounts.toSorted(byValue)).toEqual([
      { value: "c21", count: 3 },
      { value: "c22", count: 1 },
    ]);
  });

  it("keeps the documents any of whose asks was made within the days", async () => {
    signInAs("admin");

    const onTheDay = await documentIdsOf({ asked: { from: "2026-06-24", to: "2026-06-24" } });
    const before = await documentIdsOf({ asked: { to: "2026-06-21" } });

    expect(onTheDay).toEqual(expect.arrayContaining(["D20", "D25", "D31"])); // D20 also on 22 Jun
    expect(onTheDay).not.toContain("D21");
    expect(before.toSorted()).toEqual(["D21", "D23", "D24"]);
  });

  it("refuses those without request.read (VIEW-requests)", async () => {
    signInAs("staff");

    expect(await statusOf(listRequests({}))).toBe(403);
  });
});

const byValue = (first: { value: string }, second: { value: string }) =>
  first.value.localeCompare(second.value);

// The approval entry belongs to each request.
function approvalEntryOf(documentId: string) {
  const request = database.requests.find((candidate) => candidate.documentId === documentId);
  const entry = database.statusLog.find(
    (entry) =>
      !isLegacyEntry(entry) &&
      entry.subjectKind === "request" &&
      entry.subjectId === request?.id &&
      entry.code === "request.approved",
  );
  return entry !== undefined && !isLegacyEntry(entry) ? entry : undefined;
}

describe("deciding", () => {
  it("approves every asker of a document at once, the oldest ask originating", async () => {
    signInAs("admin");

    const result = await approveProposal("D20", {
      categoryId: "c22",
      priority: "High",
      rescanNote: null,
    });
    const detail = await findDocument("D20");
    const relations = detail?.record.requests.map(
      (request) => request.decision === "Approved" && request.iteration?.relation,
    );

    expect(result).toEqual({ documentId: "D20", decision: "Approved", askCount: 4 });
    expect(detail?.record.iterations).toHaveLength(1);
    expect(relations).toEqual(["Originates", "Tracks", "Tracks", "Tracks"]);
    expect(await findRequest("D20")).toBeNull();
    expect(approvalEntryOf("D20")?.reason.internal).toContain(
      "Material type suggested Periodicals / National",
    );
    expect(approvalEntryOf("D20")?.reason.internal).toContain("— kept.");
  });

  it("asks why a document with a copy is scanned again", async () => {
    signInAs("admin");
    const approval = { categoryId: "c21", priority: "Normal", rescanNote: null } as const;

    expect(await statusOf(approveProposal("D30", approval))).toBe(422);
    expect(
      await approveProposal("D30", { ...approval, rescanNote: "The existing scan is 150 dpi." }),
    ).toMatchObject({ decision: "Approved" });
    expect(approvalEntryOf("D30")?.reason.internal).toContain("Regional press suggested");
  });

  it("waits for the checks, and approves only into a category with no subcategories", async () => {
    signInAs("admin");

    expect(
      await statusOf(
        approveProposal("D21", { categoryId: "c21", priority: "Normal", rescanNote: null }),
      ),
    ).toBe(409);
    expect(
      await statusOf(
        approveProposal("D32", { categoryId: "c2", priority: "Normal", rescanNote: null }),
      ),
    ).toBe(422);
  });

  it("declines with what every asker is told, never without it", async () => {
    signInAs("admin");

    expect(await statusOf(declineProposal("D33", { publicText: " ", internalText: null }))).toBe(
      422,
    );
    expect(
      await declineProposal("D33", {
        publicText: "Already published by the publisher.",
        internalText: null,
      }),
    ).toMatchObject({ decision: "Denied", askCount: 1 });
    expect(await documentIdsOf({ decisions: ["Denied"] })).toContain("D33");
  });

  it("bulk approves the batch but what was unticked, and leaves a rescan on its own", async () => {
    signInAs("admin");
    const classification = { categoryId: "c22", priority: "Normal" } as const;

    const result = await bulkApproveProposals("B-0143", {
      ...classification,
      excludedIds: ["D26"],
    });
    const open = await documentIdsOf({ batchIds: ["B-0143"], decisions: ["Pending"] });

    expect(result).toEqual({ approvedCount: 2, rescanCount: 1, checkingCount: 0 });
    expect(open.toSorted()).toEqual(["D26", "D27"]); // unticked, and the rescan
    expect(
      await bulkApproveProposals("B-0143", { ...classification, excludedIds: [] }),
    ).toMatchObject({ approvedCount: 1 });
    expect(
      await statusOf(bulkApproveProposals("B-0143", { ...classification, excludedIds: [] })),
    ).toBe(409);
  });

  it("approves a batch of any size, beyond what one slice lists", async () => {
    signInAs("admin");
    const harvestSize = maximumRequestSliceSize + 50;
    harvest("B-HARVEST", harvestSize);

    const result = await bulkApproveProposals("B-HARVEST", {
      categoryId: "c22",
      priority: "Low",
      excludedIds: [],
    });

    expect(result.approvedCount).toBe(harvestSize);
    expect(await documentIdsOf({ batchIds: ["B-HARVEST"], decisions: ["Pending"] })).toEqual([]);
  });

  it("refuses an unknown batch", async () => {
    signInAs("admin");

    expect(
      await statusOf(
        bulkApproveProposals("B-9999", { categoryId: "c22", priority: "Low", excludedIds: [] }),
      ),
    ).toBe(404);
  });

  it("refuses a curator a proposal outside their request custody", async () => {
    signInAs("curator");

    expect(
      await statusOf(
        approveProposal("D31", { categoryId: "c4", priority: "Normal", rescanNote: null }),
      ),
    ).toBe(403);
    expect(await findRequest("D31")).toBeNull();
  });

  it("logs a suggestion the decider changed as overruled, and one a batch changed as overridden", async () => {
    signInAs("admin");

    await approveProposal("D32", { categoryId: "c21", priority: "Normal", rescanNote: null });

    expect(approvalEntryOf("D32")?.reason.internal).toContain("says otherwise”) — overruled.");
    expect(approvalEntryOf("D28")?.reason.internal).toContain(
      "— overridden by the batch's category.",
    );
  });
});

describe("ACT-withdraw", () => {
  it("takes back the caller's own ask while it waits, once", async () => {
    signInAs("reader");

    const result = await withdrawAsk("D21");
    const ask = database.requests.find((request) => request.id === "R19");

    expect(result.requestId).toBe("R19");
    expect(ask?.decision).toBe("Withdrawn");
    expect(await statusOf(withdrawAsk("D21"))).toBe(409); // LC-REQ-final
  });

  it("leaves other people's asks alone", async () => {
    signInAs("reader");

    expect(await statusOf(withdrawAsk("D22"))).toBe(404); // a1's
    expect(database.requests.find((request) => request.id === "R20")?.decision).toBe("Pending");
  });

  it("needs request.withdraw_own", async () => {
    signInAs("no-access");

    expect(await statusOf(withdrawAsk("D30"))).toBe(403);
  });
});
