// The Documents pane's More ▾ end to end against the mock server over HTTP: reclassifying a
// document's iteration and setting where its scan is available,
// each within the caller's grant and the iteration's state. Each changes the mock's state, so
// each test acts on its own iteration.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { findDocument } from "@/api/documents";
import { ApiError } from "@/api/http";
import { publishIteration, reclassifyIteration } from "@/api/iterations";
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

async function currentIterationOf(documentId: string) {
  const detail = await findDocument(documentId);
  return detail?.record.iterations.at(-1);
}

describe("reclassifying", () => {
  it("changes category and priority inside the curator's custody", async () => {
    signInAs("curator");

    const result = await reclassifyIteration("IT3", { categoryId: "c22", priority: "High" });
    const current = await currentIterationOf("D3");

    expect(result.isHandedOver).toBe(false);
    expect(current?.categoryId).toBe("c22");
    expect(current?.priority).toBe("High");
  });

  it("hands an item over when its new category is outside the curator's custody", async () => {
    signInAs("curator");

    const result = await reclassifyIteration("IT15", { categoryId: "c11", priority: "Normal" });

    expect(result.isHandedOver).toBe(true); // Monographs are not Periodicals or Maps
    expect(
      await statusOf(reclassifyIteration("IT15", { categoryId: "c23", priority: "Normal" })),
    ).toBe(403); // and cannot be moved back
  });

  it("refuses outside the grant, after the scan and into a category with subcategories", async () => {
    signInAs("curator");

    expect(
      await statusOf(reclassifyIteration("IT33", { categoryId: "c21", priority: "Low" })),
    ).toBe(403); // Early modern manuscripts are not the curator's
    expect(await statusOf(reclassifyIteration("IT1", { categoryId: "c21", priority: "Low" }))).toBe(
      409,
    ); // Published
    expect(await statusOf(reclassifyIteration("IT26", { categoryId: "c2", priority: "Low" }))).toBe(
      422,
    );
  });

  it("is not staff's to do", async () => {
    signInAs("staff");

    expect(
      await statusOf(reclassifyIteration("IT27", { categoryId: "c21", priority: "Low" })),
    ).toBe(404);
  });
});

describe("setting where it is available", () => {
  it("publishes a digitized item at its link", async () => {
    signInAs("admin");

    const result = await publishIteration("IT12", {
      link: "https://kramerius.mzk.cz/view/uuid:d12",
    });
    const detail = await findDocument("D12");

    expect(result.progress).toBe("Published");
    expect(detail?.record.iterations.at(-1)?.publishedLink).toBe(
      "https://kramerius.mzk.cz/view/uuid:d12",
    );
    expect(detail?.log[0]?.event).toBe("Published");
  });

  it("changes the link of a published item and keeps the old one in the history", async () => {
    signInAs("curator");

    await publishIteration("IT34", { link: "https://kramerius.mzk.cz/view/uuid:d50-new" });
    const detail = await findDocument("D50");

    expect(detail?.log[0]?.event).toBe("Link changed");
    expect(detail?.log[0]?.detail).toContain("uuid:demo50");
  });

  it("refuses an item not yet scanned, one outside the grant, and a link that is not a web address", async () => {
    signInAs("curator");

    expect(await statusOf(publishIteration("IT28", { link: "https://a.cz/x" }))).toBe(409); // Ready, in custody
    expect(await statusOf(publishIteration("IT37", { link: "https://a.cz/x" }))).toBe(403);
    expect(await statusOf(publishIteration("IT36", { link: "ftp://a.cz/x" }))).toBe(422);
  });
});
