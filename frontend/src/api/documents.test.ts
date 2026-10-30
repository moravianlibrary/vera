import { eventEntry } from "./event-entries-test";
// The Documents resource end to end: typed API calls against the mock server over HTTP, as the
// views will make them, for a requester and for a curator.

import type { DocumentGrouping, DocumentQuery } from "@vera/contract/documents";
import {
  isSameDocumentQuery,
  maximumDocumentSliceSize,
  parseDocumentSearchParams,
  toDocumentSearchParams,
} from "@vera/contract/documents";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { findDocument, listDocuments } from "@/api/documents";
import type { MockUserProfile } from "@/config/env";
import { database } from "@/mocks/database";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

describe("listDocuments as a reader", () => {
  it("withholds an event entry's data and internal reason", async () => {
    const request = database.requests.find((candidate) => candidate.requesterId === "u5");
    expect(request).toBeDefined();
    if (request === undefined) return;
    const event = {
      id: "E-public-event-test",
      subjectKind: "request" as const,
      subjectId: request.id,
      at: "2026-06-01T00:00:00Z",
      actor: { kind: "user" as const, userId: "u1" },
      correlationId: "public-test",
      reason: { public: "Received", internal: "Staff only" },
      code: "request.created" as const,
      data: { batch: { id: "B1", name: "Batch one" }, source: null },
    };
    database.statusLog.push(event);
    try {
      signInAs("reader");
      const detail = await findDocument(request.documentId);
      const result = detail?.log.find((entry) => entry.id === event.id);
      expect(result).toBeDefined();
      if (result === undefined) return;
      expect(result.data).toBeNull();
      expect(result.reason.internal).toBeNull();
      expect(result.reason.public).toBe("Received");
      expect(result.actor.kind).toBe("undisclosed");
    } finally {
      const index = database.statusLog.findIndex((entry) => entry.id === event.id);
      if (index >= 0) database.statusLog.splice(index, 1);
    }
  });

  it("gives staff the same public reach", async () => {
    signInAs("staff");
    const page = await listDocuments({});

    expect(page.audience).toBe("public");
    expect(
      page.items.every((record) =>
        record.requests.every((request) => request.requesterId === "u4"),
      ),
    ).toBe(true);
  });

  it("returns only the documents they asked for, in the public vocabulary", async () => {
    signInAs("reader");

    const page = await listDocuments({});

    expect(page.audience).toBe("public");
    expect(page.items.length).toBeGreaterThan(0);
    expect(
      page.items.every((record) =>
        record.requests.every((request) => request.requesterId === "u5"),
      ),
    ).toBe(true); // a reader's reach is authorship
  });

  it("withholds internal reasons", async () => {
    signInAs("reader");

    const page = await listDocuments({});

    const internalTexts = page.items.flatMap((record) => [
      ...record.iterations.flatMap((iteration) =>
        iteration.defects.map((defect) => defect.internalText),
      ),
      ...record.iterations.map((iteration) => iteration.cancellation?.internalText ?? null),
    ]);
    expect(internalTexts.every((text) => text === null)).toBe(true);
  });
});

describe("My Documents at request.read_mine@project (VIEW-documents-audience)", () => {
  // u9 holds project-user and is on p1 and p2 through group g2.
  const ownProjects = new Set(["p1", "p2"]);
  const isReached = (request: { requesterId: string; projectId: string | null }) =>
    request.requesterId === "u9" ||
    (request.projectId !== null && ownProjects.has(request.projectId));

  it("shows what other members asked for in their projects, in public detail", async () => {
    signInAs("project-user");
    const page = await listDocuments({}, { perspective: "my", limit: maximumDocumentSliceSize });

    expect(page.audience).toBe("public");
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((record) => record.requests.every(isReached))).toBe(true);
    expect(
      page.items.some((record) => record.requests.some((request) => request.requesterId !== "u9")),
    ).toBe(true);
  });

  it("does not open a document nobody asked for in their projects", async () => {
    const outside = database.documents.find((document) => {
      const requests = database.requests.filter((request) => request.documentId === document.id);
      return requests.length > 0 && !requests.some(isReached);
    });
    expect(outside).toBeDefined();
    if (outside === undefined) return;

    signInAs("project-user");
    expect(await findDocument(outside.id, "my")).toBeNull();
  });
});

describe("listDocuments as curator", () => {
  it("shows a dual-permission user their own requests with public status in My Documents", async () => {
    signInAs("curator");
    const original = database.requests[0];
    expect(original).toBeDefined();
    if (!original) return;
    database.requests[0] = { ...original, requesterId: "u8" };
    try {
      const staff = await listDocuments({});
      const mine = await listDocuments({}, { perspective: "my" });

      expect(staff.audience).toBe("staff");
      expect(mine.audience).toBe("public");
      expect(mine.total).toBeGreaterThan(0);
      expect(mine.total).toBeLessThan(staff.total);
      expect(
        mine.items.every((record) => record.requests.every((ask) => ask.requesterId === "u8")),
      ).toBe(true);
      expect(mine.facets.statuses.length).toBeGreaterThan(0);
      expect(mine.facets.decisions).toEqual([]);
    } finally {
      database.requests[0] = original;
    }
  });

  it("filters on the stored dimensions, not the displayed status", async () => {
    signInAs("curator");
    const all = await listDocuments({});
    const forbidden = all.facets.forbidden.find((entry) => entry.value === "Yes");

    const page = await listDocuments({ forbidden: ["Yes"] });

    expect(page.total).toBe(forbidden?.count ?? -1);
    expect(page.total).toBeGreaterThan(0);
    // Once scanned, a restriction no longer shows in the badge but is still held.
    expect(page.items.every((record) => record.iterations.at(-1)?.restriction !== null)).toBe(true);
  });

  it("holds approved work only, leaving undecided asks to Requests (VIEW-documents-audience)", async () => {
    signInAs("curator");

    const page = await listDocuments({}, { limit: maximumDocumentSliceSize });

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((record) => record.iterations.length > 0)).toBe(true);
  });

  it("matches an iteration ID whole, not as a prefix", async () => {
    signInAs("curator");

    const page = await listDocuments({ search: "IT1" });

    expect(page.items.map((record) => record.document.id)).toEqual(["D1"]); // not IT10–IT19
  });
});

describe("listDocuments facets", () => {
  it("matches any value within a field and every field together", async () => {
    signInAs("curator");

    const page = await listDocuments({ priorities: ["Urgent", "High"], existingCopies: ["None"] });

    expect(page.items.length).toBeGreaterThan(0);
    expect(
      page.items.every((record) => {
        const priority = record.iterations.at(-1)?.priority;
        return (
          (priority === "Urgent" || priority === "High") &&
          record.document.registryRecords.every((registry) => registry.state === "NotFound")
        );
      }),
    ).toBe(true);
  });

  it("counts a field over the other filters, not over itself", async () => {
    signInAs("curator");
    const all = await listDocuments({});
    const urgent = all.facets.priorities.find((entry) => entry.value === "Urgent");

    const page = await listDocuments({ priorities: ["Urgent"] });

    expect(page.total).toBe(urgent?.count ?? -1);
    expect(page.facets.priorities).toEqual(all.facets.priorities); // facets do not narrow themselves
    expect(page.facets.existingCopies).not.toEqual(all.facets.existingCopies);
  });

  it("counts a category over its whole subtree", async () => {
    signInAs("curator");
    const all = await listDocuments({});
    const [root] = all.facets.categoryIds.toSorted((first, second) => second.count - first.count);

    const page = await listDocuments({ categoryIds: [root?.value ?? ""] });

    expect(page.total).toBe(root?.count ?? -1);
  });

  it("offers a requester no fields beyond search and status", async () => {
    signInAs("reader");
    const all = await listDocuments({});

    const page = await listDocuments({ priorities: ["Urgent"], decisions: ["Denied"] });

    const { statuses, ...staffFacets } = page.facets;
    expect(statuses.length).toBeGreaterThan(0);
    expect(Object.values(staffFacets).every((counts) => counts.length === 0)).toBe(true);
    expect(page.total).toBe(all.total); // the fields do not exist for them
  });

  it("filters a requester on their own ask's public status", async () => {
    signInAs("reader");
    const all = await listDocuments({});
    const [first, second] = all.facets.statuses;

    const page = await listDocuments({
      statuses: [first?.value ?? "Available", second?.value ?? "Available"],
    });

    expect(page.total).toBe((first?.count ?? 0) + (second?.count ?? 0));
  });
});

describe("listDocuments ranges", () => {
  it("keeps the documents whose page count in use falls in the range, ends included", async () => {
    signInAs("curator");
    const all = await listDocuments({}, { limit: maximumDocumentSliceSize });

    const page = await listDocuments(
      { pages: { from: 1000 } },
      { limit: maximumDocumentSliceSize },
    );

    expect(page.total).toBeGreaterThan(0);
    expect(page.total).toBeLessThan(all.total);
    expect(
      page.items.every((record) => {
        const sources = record.document.pageSources.toSorted((a, b) => b.tier - a.tier);
        return (sources[0]?.value ?? -1) >= 1000;
      }),
    ).toBe(true); // a document with no page count is in no range
  });

  it("keeps the documents a current asker asked for within the days", async () => {
    signInAs("curator");
    const asked = { from: "2026-06-20", to: "2026-06-25" };

    const page = await listDocuments({ asked }, { limit: maximumDocumentSliceSize });

    expect(page.total).toBeGreaterThan(0);
    expect(
      page.items.every((record) =>
        record.requests.some((request) => request.at.slice(0, 10) >= asked.from),
      ),
    ).toBe(true);
  });

  it("ignores ranges for a requester, who has only the status", async () => {
    signInAs("reader");
    const all = await listDocuments({});

    const page = await listDocuments({ pages: { from: 100000 } });

    expect(page.total).toBe(all.total);
  });
});

describe("listDocuments slices", () => {
  it("walks every row once, in the order of a single slice", async () => {
    signInAs("curator");
    const whole = await listDocuments({}, { cursor: null, limit: maximumDocumentSliceSize });

    const walked: string[] = [];
    let cursor: string | null = null;
    do {
      const slice = await listDocuments({}, { cursor, limit: 20 });
      expect(slice.total).toBe(whole.total);
      walked.push(...slice.items.map((record) => record.document.id));
      cursor = slice.nextCursor;
    } while (cursor !== null);

    expect(walked).toEqual(whole.items.map((record) => record.document.id));
  });

  it("ends with no next cursor", async () => {
    signInAs("curator");

    const page = await listDocuments({}, { cursor: null, limit: maximumDocumentSliceSize });

    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(page.total);
  });
});

describe("listDocuments grouping", () => {
  const sliceWalk = async (grouping: DocumentGrouping) => {
    const slices = [];
    let cursor: string | null = null;
    do {
      const slice = await listDocuments({}, { grouping, cursor, limit: 7 });
      slices.push(slice);
      cursor = slice.nextCursor;
    } while (cursor !== null);

    return slices;
  };

  it("keeps each group together across slices, its header counting the whole group", async () => {
    signInAs("curator");

    const slices = await sliceWalk("project");

    const keys = slices.flatMap((slice) =>
      slice.groups.flatMap((group) =>
        Array.from({ length: group.rowCount }, () =>
          group.kind === "project" ? (group.project?.id ?? null) : null,
        ),
      ),
    );
    const rows = slices.flatMap((slice) => slice.items);
    expect(keys).toHaveLength(rows.length);
    const runs = keys.filter((key, index) => index === 0 || keys[index - 1] !== key);
    expect(new Set(runs).size).toBe(runs.length); // no group comes back after another
    expect(runs.at(-1)).toBeNull(); // the rows with no project come last

    const totals = slices.flatMap((slice) => slice.groups).map((group) => group.total);
    const firstGroupRows = keys.filter((key) => key === keys[0]).length;
    expect(totals[0]).toBe(firstGroupRows);
  });

  it("puts batches with failed additions first", async () => {
    signInAs("admin");

    const page = await listDocuments({}, { grouping: "batch", limit: maximumDocumentSliceSize });

    const failed = page.groups.map((group) =>
      group.kind === "batch" ? group.additions.failed : -1,
    );
    expect(failed).toEqual(failed.toSorted((first, second) => second - first));
    expect(page.groups.at(-1)).toMatchObject({ kind: "batch", batch: null });
  });

  it("counts every document of a batch in exactly one addition state", async () => {
    signInAs("admin");

    const page = await listDocuments({}, { grouping: "batch", limit: maximumDocumentSliceSize });

    for (const group of page.groups) {
      if (group.kind !== "batch" || group.batch === null) {
        continue;
      }

      const counted = Object.values(group.additions).reduce((sum, count) => sum + count, 0);
      expect(counted, group.batch.id).toBe(group.size);
    }
  });

  it("does not group a staff member's public list by batch", async () => {
    signInAs("staff");

    const page = await listDocuments({}, { grouping: "batch" });

    expect(page.groups).toEqual([]);
  });

  it("does not group a requester's list", async () => {
    signInAs("reader");

    const page = await listDocuments({}, { grouping: "project" });

    expect(page.groups).toEqual([]);
  });
});

describe("findDocument", () => {
  it("returns null for a document outside the caller's reach", async () => {
    signInAs("reader");

    const detail = await findDocument("D2");

    expect(detail).toBeNull(); // D2 was asked for by someone else
  });

  it("hides who acted and why from a requester's history", async () => {
    signInAs("reader");

    const detail = await findDocument("D1");

    expect(detail?.log.length).toBeGreaterThan(0);
    expect(
      detail?.log.every(
        (entry) =>
          eventEntry(entry).reason.internal === null && eventEntry(entry).actor.kind !== "user",
      ),
    ).toBe(true);
  });

  it("tells a requester their story in plain words, without the machinery", async () => {
    signInAs("reader");

    const detail = await findDocument("D17");
    const events = detail?.log.map((entry) => eventEntry(entry).code) ?? [];

    expect(events).not.toContain("iteration.ingest_failed");
  });

  it("keeps another person's ingest failure outside staff's reach", async () => {
    signInAs("staff");

    const detail = await findDocument("D7");
    expect(detail).toBeNull();
  });
});

describe("document search params", () => {
  it("round-trip through the URL", () => {
    const query: DocumentQuery = {
      search: "Moravská",
      statuses: ["Available", "OnHold"],
      isMine: true,
      decisions: ["Pending", "Approved"],
      progress: ["Ready", "Digitized"],
      validations: ["Needed"],
      forbidden: ["Yes"],
      cancelled: ["No"],
      categoryIds: ["c2", "c11"],
      projectIds: ["p1"],
      priorities: ["Urgent", "High"],
      existingCopies: ["None", "Published"],
      askerIds: ["u5"],
      pages: { from: 200, to: 1000 },
      asked: { from: "2026-06-01" },
    };

    const parsed = parseDocumentSearchParams(toDocumentSearchParams(query));

    expect(parsed).toEqual(query);
  });

  it("drops unknown values and keeps the rest of a list", () => {
    const params = new URLSearchParams("priority=Urgent,Soon,&copy=Published,Lost&category=");

    const parsed = parseDocumentSearchParams(params);

    expect(parsed.priorities).toEqual(["Urgent"]);
    expect(parsed.existingCopies).toEqual(["Published"]);
    expect(parsed.categoryIds).toBeUndefined();
  });

  it("names the same filter whatever the order of its values", () => {
    expect(
      isSameDocumentQuery(
        { priorities: ["Urgent", "High"], search: "Brno" },
        { search: "Brno", priorities: ["High", "Urgent"] },
      ),
    ).toBe(true);
    expect(isSameDocumentQuery({ priorities: ["Urgent"] }, {})).toBe(false);
  });
});
