// Proposing end to end against the mock server over HTTP: what each item's check says it will
// do, and what a submit makes of it, for a requester and a curator.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { findDocument } from "@/api/documents";
import { ApiError } from "@/api/http";
import type { ProposalDraft, ProposalItem } from "@/api/proposals";
import {
  checkProposalItems,
  getProposalSettings,
  getRateLimitStatus,
  readPhoto,
  readRecordLink,
  searchCatalogs,
  submitProposal,
} from "@/api/proposals";
import type { MockUserProfile } from "@/config/env";
import { database } from "@/mocks/database";
import { createHandlers } from "@/mocks/handlers";
import { resolveSession } from "@/mocks/session";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
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

const catalogItem = (value: string, unit: string | null = null): ProposalItem => ({
  type: "catalogId",
  value,
  unit,
});

function draftOf(items: ProposalItem[], overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    items: items.map((item) => ({ ...item, reason: null })),
    reason: "For the seminar",
    projectId: null,
    batchName: null,
    approval: null,
    ...overrides,
  };
}

describe("checkProposalItems", () => {
  it("says what submitting each item will do", async () => {
    signInAs("reader");

    const checks = await checkProposalItems([
      catalogItem("MZK01-001277001"),
      catalogItem("MZK01-001277001", "1940"),
      catalogItem("MZK01-001277001", "1936–1938"),
      { type: "nbn", value: "cnb001388120", unit: null },
      catalogItem("MZK09-999999999"),
    ]);

    expect(checks.map((check) => check.kind)).toEqual([
      "whichUnit",
      "new",
      "inVera",
      "inVera",
      "notInCatalog",
    ]);
  });

  it("resolves a shelf mark through the catalog (DOC-identifiers)", async () => {
    signInAs("reader");

    const checks = await checkProposalItems([
      { type: "shelfMark", value: "st3-0871", unit: null },
      { type: "shelfMark", value: "XX-0000", unit: null },
    ]);

    expect(checks.map((check) => check.kind)).toEqual(["new", "notInCatalog"]);
  });

  it("takes the unit a shelf mark is on, and asks when it names none (DOC-units)", async () => {
    signInAs("reader");

    const checks = await checkProposalItems([
      { type: "shelfMark", value: "ST2-0951", unit: null },
      { type: "shelfMark", value: "ST2-095x", unit: null },
    ]);

    expect(checks.map((check) => check.kind)).toEqual(["new", "whichUnit"]);
  });

  it("offers the records an identifier names when the catalog gives several (DOC-records)", async () => {
    signInAs("reader");

    const [check] = await checkProposalItems([
      { type: "shelfMark", value: "ST3-0880", unit: null },
    ]);

    expect(check).toEqual({
      kind: "whichRecord",
      records: [
        { catalogId: "MZK03-000112877", title: "Kniha o Brně" },
        { catalogId: "MZK03-000778120", title: "Moravské kostely" },
      ],
    });
  });

  it("speaks to a requester in the public vocabulary", async () => {
    signInAs("reader");

    const [check] = await checkProposalItems([catalogItem("MZK01-001277001", "1936–1938")]);

    expect(check?.kind === "inVera" && check.status).toBe("WaitingToBeScheduled");
  });

  it("recognises what the caller already asks for while it moves (LC-REQ-check)", async () => {
    signInAs("reader");

    const [moving] = await checkProposalItems([catalogItem("MZK01-000998431", "1899")]);
    const [published] = await checkProposalItems([catalogItem("MZK01-001284756", "1918–1925")]);

    expect(moving?.kind).toBe("mine");
    expect(published).toMatchObject({ kind: "new", isAskedBefore: true });
  });

  it("takes an ask after a published or cancelled attempt as new (LC-REQ-join)", async () => {
    signInAs("staff");
    const [afterPublished] = await checkProposalItems([
      catalogItem("MZK01-001284756", "1918–1925"),
    ]);

    signInAs("curator");
    const [afterCancelled] = await checkProposalItems([catalogItem("MZK04-000067120")]);

    expect(afterPublished).toMatchObject({ kind: "new", isAskedBefore: true });
    expect(afterCancelled).toMatchObject({ kind: "new", isAskedBefore: true });
  });
});

describe("submitProposal", () => {
  it("uses the same batch limit but different daily totals for reader and staff", async () => {
    signInAs("reader");
    expect((await getProposalSettings()).maxAtOnce).toBe(10);
    expect((await getRateLimitStatus()).perDay).toBe(100);

    signInAs("staff");
    expect((await getProposalSettings()).maxAtOnce).toBe(10);
    expect((await getRateLimitStatus()).perDay).toBe(300);
  });

  it("counts accepted items until midnight in the library's calendar day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-06-25T21:59:00Z")); // 23:59 in Prague
    signInAs("reader");

    const before = await getRateLimitStatus();
    const report = await submitProposal(
      draftOf([catalogItem("NKC01-002345678", "roč. 12"), catalogItem("MZK09-999999999")]),
    );
    expect(report.proposed + report.joined).toBe(1);
    expect((await getRateLimitStatus()).perDay).toBe((before.perDay ?? 0) - 1);

    vi.setSystemTime(new Date("2030-06-25T22:01:00Z")); // 00:01 next day in Prague
    expect((await getRateLimitStatus()).perDay).toBe(before.perDay);
  });

  it("returns an unlimited daily status for a decider", async () => {
    signInAs("curator");
    expect((await getRateLimitStatus()).perDay).toBeNull();
    expect((await getProposalSettings()).maxAtOnce).toBeNull();
  });

  it("applies a role's finite limits even when it grants request.decide", async () => {
    const heldRoleIds = resolveSession("curator").roleIds;
    const heldRoles = database.roles.filter((role) => heldRoleIds.includes(role.id));
    const previousLimits = heldRoles.map((role) => ({
      batch: role.proposalBatchLimit,
      day: role.proposalDailyLimit,
    }));
    for (const role of heldRoles) {
      role.proposalBatchLimit = 1;
      role.proposalDailyLimit = 0;
    }
    signInAs("curator");

    try {
      expect((await getProposalSettings()).maxAtOnce).toBe(1);
      expect(
        await statusOf(
          submitProposal(
            draftOf([catalogItem("NKC01-002345678", "roč. 13"), catalogItem("MZK09-999999999")]),
          ),
        ),
      ).toBe(422);
      expect((await getRateLimitStatus()).perDay).toBe(0);
      expect(
        await statusOf(submitProposal(draftOf([catalogItem("NKC01-002345678", "roč. 13")]))),
      ).toBe(429);
    } finally {
      heldRoles.forEach((role, index) => {
        role.proposalBatchLimit = previousLimits[index]?.batch ?? null;
        role.proposalDailyLimit = previousLimits[index]?.day ?? null;
      });
    }
  });

  it("refuses an accepted item after today's quota and allows it tomorrow", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-07-01T12:00:00Z"));
    signInAs("reader");
    const reader = database.roles.find((role) => role.id === "reader");
    if (reader === undefined) throw new Error("Missing reader role");
    const previousLimit = reader.proposalDailyLimit;
    reader.proposalDailyLimit = 1;

    try {
      await submitProposal(draftOf([catalogItem("MZK01-001277001", "1940")]));
      expect((await getRateLimitStatus()).perDay).toBe(0);

      const next = draftOf([catalogItem("MZK01-001520331", "roč. 1")]);
      expect(await statusOf(submitProposal(next))).toBe(429);

      vi.setSystemTime(new Date("2031-07-01T22:01:00Z")); // next day in Prague
      expect((await getRateLimitStatus()).perDay).toBe(1);
      expect(await statusOf(submitProposal(next))).toBeNull();
    } finally {
      reader.proposalDailyLimit = previousLimit;
    }
  });

  it("proposes the new, joins the rest, skips the unknown, and makes one batch", async () => {
    signInAs("reader");

    const report = await submitProposal(
      draftOf([
        catalogItem("MZK01-001622010", "1890"),
        catalogItem("MZK01-001277001", "1936–1938"),
        catalogItem("MZK09-999999999"),
      ]),
    );

    expect(report.proposed).toBe(1);
    expect(report.joined).toBe(1);
    expect(report.skipped.map((item) => item.value)).toEqual(["MZK09-999999999"]);
    expect(report.batch).not.toBeNull();

    const [check] = await checkProposalItems([catalogItem("MZK01-001622010", "1890")]);
    expect(check?.kind === "mine" && (await findDocument(check.documentId))).toBeTruthy();
  });

  it("holds a requester to the limit, and to proposing without approving", async () => {
    signInAs("reader");
    const tooMany = Array.from({ length: 11 }, (_, index) =>
      catalogItem(`MZK03-${String(900000000 + index)}`),
    );

    expect(await statusOf(submitProposal(draftOf(tooMany)))).toBe(422);
    expect(
      await statusOf(
        submitProposal(
          draftOf([catalogItem("MZK01-001520331", "roč. 1")], {
            approval: { categoryId: "c1", priority: "Normal" },
          }),
        ),
      ),
    ).toBe(403);
  });

  it("refuses a project the caller is not a member of", async () => {
    signInAs("reader");

    const status = await statusOf(
      submitProposal(draftOf([catalogItem("NKC01-002345678", "roč. 12")], { projectId: "p1" })),
    );

    expect(status).toBe(422);
  });

  it("approves a curator's new item at once when no copy exists", async () => {
    signInAs("curator");

    const report = await submitProposal(
      draftOf([catalogItem("NKC01-002345678", "roč. 13")], {
        approval: { categoryId: "c1", priority: "High" },
      }),
    );

    expect(report).toMatchObject({ proposed: 1, approved: 1, batch: { size: 1 } });
  });

  it("makes a batch of one item too (ENT-batch)", async () => {
    signInAs("staff");

    const report = await submitProposal(draftOf([catalogItem("MZK01-001520331", "roč. 2")]));

    expect(report.batch).toMatchObject({
      size: 1,
      name: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
    });
    expect(database.requests.at(-1)?.batchId).toBe(report.batch?.id);
  });

  it("proposes a rescan beside the published copy, approve now or not (LC-REQ-join)", async () => {
    signInAs("curator");

    const report = await submitProposal(
      draftOf([catalogItem("MZK01-001284756", "1918–1925")], {
        approval: { categoryId: "c1", priority: "High" },
      }),
    );
    const ask = database.requests.at(-1);

    expect(report).toMatchObject({ proposed: 1, approved: 0, joined: 0 });
    expect(ask).toMatchObject({ documentId: "D1", requesterId: "u8", decision: "Pending" });
    expect(ask?.existingCopies.map((copy) => copy.source)).toContain("VERA");
  });
});

describe("the ways in (ACT-ways-in)", () => {
  it("offers each way while its plugin is enabled (PERM-absent-not-disabled)", async () => {
    signInAs("reader");
    const settings = await getProposalSettings();

    expect(settings).toMatchObject({
      canDetectTypes: true,
      canScanWithCamera: true,
      canReadPhotos: true,
    });
    expect(settings.searchCatalogs.map(({ name }) => name)).toEqual(["MZK Aleph", "VKOL Aleph"]);
    expect(settings.linkCatalogs.map(({ name }) => name)).toEqual(["NKP Aleph"]);

    const instances = database.pluginInstances;
    database.pluginInstances = instances.map((instance) =>
      ["pi11", "pi12", "pi13", "pi2"].includes(instance.id)
        ? { ...instance, isEnabled: false }
        : instance,
    );
    try {
      expect(await getProposalSettings()).toMatchObject({
        canDetectTypes: false,
        canScanWithCamera: false,
        canReadPhotos: false,
        linkCatalogs: [],
      });
    } finally {
      database.pluginInstances = instances;
    }
  });

  it("searches the catalogs that can be searched, one or all", async () => {
    signInAs("reader");
    const everywhere = await searchCatalogs("slovácké", null);

    expect(everywhere.map(({ catalogId, catalog }) => [catalogId, catalog.name])).toEqual([
      ["MZK01-001277001", "MZK Aleph"],
      ["VKOL01-000456123", "VKOL Aleph"],
    ]);
    expect((await searchCatalogs("slovácké", "pi3")).map(({ catalogId }) => catalogId)).toEqual([
      "VKOL01-000456123",
    ]);
    expect(await searchCatalogs("zlatá praha", null)).toEqual([]);
  });

  it("reads a record link or ID in a catalog that cannot be searched", async () => {
    signInAs("reader");

    expect(
      await readRecordLink({
        catalogInstanceId: "pi2",
        link: "https://aleph.nkp.cz/F/?func=direct&doc_number=002345678&base=NKC01",
      }),
    ).toEqual({ catalogId: "NKC01-002345678" });
    expect(await readRecordLink({ catalogInstanceId: "pi2", link: "NKC01-002345678" })).toEqual({
      catalogId: "NKC01-002345678",
    });
    expect(await statusOf(readRecordLink({ catalogInstanceId: "pi2", link: "Zlatá Praha" }))).toBe(
      422,
    );
    expect(await statusOf(readRecordLink({ catalogInstanceId: "pi1", link: "MZK01-1" }))).toBe(404);
  });

  it("reads a photo into candidates, each with why it matched", async () => {
    signInAs("reader");
    const reading = await readPhoto(new File(["jpeg"], "card.jpg", { type: "image/jpeg" }));

    expect(reading.hasIdentifiers).toBe(false);
    expect(reading.candidates[0]).toMatchObject({
      catalogId: "MZK03-000778120",
      why: "title and author match",
    });
  });
});
