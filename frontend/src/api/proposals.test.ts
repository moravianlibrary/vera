// Proposing end to end against the mock server over HTTP: what each item's check says it will
// do, and what a submit makes of it, for a requester and a curator.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { findDocument } from "@/api/documents";
import { ApiError } from "@/api/http";
import type { ProposalDraft, ProposalItem } from "@/api/proposals";
import { checkProposalItems, submitProposal } from "@/api/proposals";
import type { MockUserProfile } from "@/config/env";
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
    via: "pastedList",
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
      { type: "cnb", value: "cnb001388120", unit: null },
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

  it("speaks to a requester in the public vocabulary", async () => {
    signInAs("reader");

    const [check] = await checkProposalItems([catalogItem("MZK01-001277001", "1936–1938")]);

    expect(check?.kind === "inVera" && check.status).toBe("WaitingToBeScheduled");
  });

  it("recognises what the caller already asks for", async () => {
    signInAs("reader");

    const [check] = await checkProposalItems([catalogItem("MZK01-001284756", "1918–1925")]);

    expect(check?.kind).toBe("mine");
  });
});

describe("submitProposal", () => {
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

    expect(report).toMatchObject({ proposed: 1, approved: 1, batch: null });
  });
});
