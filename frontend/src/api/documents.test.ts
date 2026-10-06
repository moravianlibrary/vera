// The Documents resource end to end: typed API calls against the mock server over HTTP, as the
// views will make them, for a requester and for staff.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { DocumentGrouping, DocumentQuery } from "@/api/documents";
import {
  findDocument,
  isSameDocumentQuery,
  listDocuments,
  maximumDocumentSliceSize,
  parseDocumentSearchParams,
  toDocumentSearchParams,
} from "@/api/documents";
import type { MockUserProfile } from "@/config/env";
import { progressValues } from "@/domain/entities";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

describe("listDocuments as a reader", () => {
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

describe("listDocuments as staff", () => {
  it("filters on the stored dimensions, not the displayed status", async () => {
    signInAs("staff");
    const all = await listDocuments({});
    const restricted = all.facets.restricted.find((entry) => entry.value === "Yes");

    const page = await listDocuments({ restricted: ["Yes"] });

    expect(page.total).toBe(restricted?.count ?? -1);
    expect(page.total).toBeGreaterThan(0);
    // Once scanned, a restriction no longer shows in the badge but is still held.
    expect(page.items.every((record) => record.iterations.at(-1)?.restriction !== null)).toBe(true);
  });

  it("gives a document with no iteration no progress", async () => {
    signInAs("staff");

    const page = await listDocuments({ decisions: ["Pending"], progress: [...progressValues] });
    const pendingOnly = await listDocuments({ decisions: ["Pending"] });

    expect(page.total).toBeLessThan(pendingOnly.total); // the proposals drop out
    expect(page.items.every((record) => record.iterations.length > 0)).toBe(true);
  });

  it("matches an iteration ID whole, not as a prefix", async () => {
    signInAs("staff");

    const page = await listDocuments({ search: "IT1" });

    expect(page.items.map((record) => record.document.id)).toEqual(["D1"]); // not IT10–IT19
  });
});

describe("listDocuments facets", () => {
  it("matches any value within a field and every field together", async () => {
    signInAs("staff");

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
    signInAs("staff");
    const all = await listDocuments({});
    const urgent = all.facets.priorities.find((entry) => entry.value === "Urgent");

    const page = await listDocuments({ priorities: ["Urgent"] });

    expect(page.total).toBe(urgent?.count ?? -1);
    expect(page.facets.priorities).toEqual(all.facets.priorities); // facets do not narrow themselves
    expect(page.facets.existingCopies).not.toEqual(all.facets.existingCopies);
  });

  it("counts a category over its whole subtree", async () => {
    signInAs("staff");
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
    signInAs("staff");
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
    signInAs("staff");
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
    signInAs("staff");
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
    signInAs("staff");

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
    signInAs("staff");

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

    const failed = page.groups.map((group) => (group.kind === "batch" ? group.failed : -1));
    expect(failed).toEqual(failed.toSorted((first, second) => second - first));
    expect(page.groups.at(-1)).toMatchObject({ kind: "batch", batch: null });
  });

  it("does not group by batch without addition.read", async () => {
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
    expect(detail?.log.every((entry) => entry.detail === null && entry.actor.kind !== "user")).toBe(
      true,
    );
  });

  it("tells a requester their story in plain words, without the machinery", async () => {
    signInAs("reader");

    const detail = await findDocument("D17");
    const events = detail?.log.map((entry) => entry.event) ?? [];

    expect(events).not.toContain("Ingest failed");
  });

  it("withholds how an ingest failed from staff who may not read additions", async () => {
    signInAs("staff");

    const detail = await findDocument("D7");
    const failure = detail?.log.find((entry) => entry.event === "Ingest failed");

    expect(failure).toBeDefined();
    expect(failure?.detail).toBeNull();
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
      restricted: ["Yes"],
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
