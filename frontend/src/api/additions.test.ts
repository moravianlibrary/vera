// Retrying a batch's failed additions end to end against the mock server over HTTP: the batch's
// failures within the scope of `request.retry` at once (ACT-retry-batch), and what is retried is being added
// again, with its attempt counted and logged.

import { maximumDocumentSliceSize } from "@vera/contract/documents";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { retryBatch } from "@/api/additions";
import { findDocument, listDocuments } from "@/api/documents";
import { ApiError } from "@/api/http";
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

describe("retrying a batch", () => {
  it("is refused to a curator when what failed is outside their custody", async () => {
    signInAs("curator");

    expect(await statusOf(retryBatch("B-0141"))).toBe(403);
  });

  it("sends every failed addition of the batch back to ingest and counts the attempt", async () => {
    signInAs("admin");

    const result = await retryBatch("B-0141");
    const detail = await findDocument("D17");
    const retried = detail?.record.iterations.at(-1);

    expect(result.retriedIds).toEqual(["IT17"]);
    expect(retried?.progress).toBe("Enqueued");
    expect(retried?.ingestFailure?.attempts).toBe(2);
    expect(detail?.log[0]?.event).toBe("Ingest retried");
  });

  it("leaves the batch's header being added, not added, and refuses a second retry", async () => {
    signInAs("admin");

    const page = await listDocuments({}, { grouping: "batch", limit: maximumDocumentSliceSize });
    const header = page.groups.find(
      (group) => group.kind === "batch" && group.batch?.id === "B-0141",
    );

    // IT17, retried, is being added; the other two of B-0141 are held by their review.
    expect(header).toMatchObject({
      additions: { failed: 0, adding: 1, reviewNeeded: 1, deniedInReview: 1 },
    });
    expect(await statusOf(retryBatch("B-0141"))).toBe(409);
  });

  it("does not know a batch that is not there", async () => {
    signInAs("admin");

    expect(await statusOf(retryBatch("B-9999"))).toBe(404);
  });
});
