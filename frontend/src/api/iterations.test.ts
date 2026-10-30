// The Documents pane's More ▾ end to end against the mock server over HTTP: reclassifying a
// document's iteration, setting where its scan is available, resuming a held one and overruling
// a restriction,
// each within the caller's grant and the iteration's state. Each changes the mock's state, so
// each test acts on its own iteration.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { findDocument } from "@/api/documents";
import { ApiError } from "@/api/http";
import {
  addLink,
  makeLinkPrimary,
  overruleRestriction,
  reclassifyIteration,
  removeLink,
  replaceLink,
  resumeIteration,
} from "@/api/iterations";
import type { MockUserProfile } from "@/config/env";
import { database } from "@/mocks/database";
import { createHandlers } from "@/mocks/handlers";
import { eventEntries, eventEntry } from "./event-entries-test";

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

    const result = await addLink("IT12", {
      link: "https://kramerius.mzk.cz/view/uuid:d12",
    });
    const second = await addLink("IT12", { link: "https://example.org/second" });
    const detail = await findDocument("D12");

    expect(result.links[0]?.isPrimary).toBe(true);
    expect(second.links[1]?.isPrimary).toBe(false);
    expect(detail?.record.iterations.at(-1)?.links[0]?.url).toBe(
      "https://kramerius.mzk.cz/view/uuid:d12",
    );
    expect(await statusOf(addLink("IT12", { link: "https://example.org/second" }))).toBe(422);
    expect(
      eventEntries(detail?.log ?? []).some((entry) => entry.code === "iteration.published"),
    ).toBe(true);
  });

  it("replaces a link in place and refuses an unknown link (ACT-link-replace)", async () => {
    signInAs("curator");
    const before = (await currentIterationOf("D50"))?.links[0];
    if (before === undefined) throw new Error("D50 has a link to replace");
    const changed = await replaceLink("IT34", before.id, {
      link: "https://example.org/replacement",
    });
    expect(changed.links[0]).toMatchObject({
      id: before.id,
      url: "https://example.org/replacement",
      isPrimary: true,
    });
    expect(await statusOf(replaceLink("IT34", "missing", { link: "https://example.org/x" }))).toBe(
      404,
    );
  });

  it("changes the primary link and refuses making it primary twice (ACT-link-primary)", async () => {
    signInAs("curator");
    const initial = await currentIterationOf("D1");
    const other = initial?.links.find((link) => !link.isPrimary);
    if (other === undefined) throw new Error("D1 has a second link to make primary");
    const changed = await makeLinkPrimary("IT1", other.id);
    expect(changed.links.find((link) => link.id === other.id)?.isPrimary).toBe(true);
    expect(changed.links.find((link) => link.id !== other.id)?.isPrimary).toBe(false);
    expect(await statusOf(makeLinkPrimary("IT1", other.id))).toBe(409);
  });

  it("removes the primary, promotes the oldest remaining link, and keeps Published (ACT-link-remove)", async () => {
    signInAs("curator");
    const initial = await currentIterationOf("D1");
    const primary = initial?.links.find((link) => link.isPrimary);
    const remaining = initial?.links.find((link) => !link.isPrimary);
    if (primary === undefined) throw new Error("D1 has a primary link to remove");
    if (remaining === undefined) throw new Error("D1 has a remaining link to promote");
    const changed = await removeLink("IT1", primary.id);
    expect(changed.links).toHaveLength(1);
    expect(changed.links[0]).toMatchObject({ id: remaining.id, isPrimary: true });
    expect(changed.progress).toBe("Published");
    expect(await statusOf(removeLink("IT1", remaining.id))).toBe(409);
  });

  it("adds a link to a published item without replacing its existing link", async () => {
    signInAs("curator");

    await addLink("IT34", { link: "https://kramerius.mzk.cz/view/uuid:d50-new" });
    const detail = await findDocument("D50");

    expect(eventEntry(detail?.log[0]).code).toBe("iteration.link_added");
    expect(detail?.record.iterations.at(-1)?.links).toHaveLength(2);
  });

  it("refuses an item not yet scanned, one outside the grant, and a link that is not a web address", async () => {
    signInAs("curator");

    expect(await statusOf(addLink("IT28", { link: "https://a.cz/x" }))).toBe(409); // Ready, in custody
    expect(await statusOf(addLink("IT37", { link: "https://a.cz/x" }))).toBe(403);
    expect(await statusOf(addLink("IT36", { link: "ftp://a.cz/x" }))).toBe(422);
  });

  it("refuses all four link acts without iteration.publish", async () => {
    signInAs("curator");

    expect(await statusOf(addLink("IT37", { link: "https://example.org/new" }))).toBe(403);
    expect(
      await statusOf(replaceLink("IT37", "missing", { link: "https://example.org/new" })),
    ).toBe(403);
    expect(await statusOf(makeLinkPrimary("IT37", "missing"))).toBe(403);
    expect(await statusOf(removeLink("IT37", "missing"))).toBe(403);
  });

  it("records each link act in the log and fires its hook event", async () => {
    signInAs("admin");
    const iterationIndex = database.iterations.findIndex((candidate) => candidate.id === "IT12");
    const original = database.iterations[iterationIndex];
    const hookTemplate = database.hooks[0];
    if (original === undefined || hookTemplate === undefined) {
      throw new Error("IT12 and a hook fixture are present");
    }

    const hookIds = ["iteration.published", "iteration.link_added", "iteration.link_changed"].map(
      (_event, index) => `test-link-act-hook-${index}`,
    );
    const hookEvents = [
      "iteration.published",
      "iteration.link_added",
      "iteration.link_changed",
    ] as const;
    const testHooks = hookEvents.map((event, index) => {
      const id = hookIds[index];
      if (id === undefined) throw new Error(`Missing hook ID for link act ${index}`);
      return {
        ...hookTemplate,
        id,
        name: `Link act test ${index}`,
        event,
        filter: "",
      };
    });
    const logStart = database.statusLog.length;
    const deliveryStart = database.hookDeliveries.length;
    database.hooks.push(...testHooks);
    database.iterations.splice(iterationIndex, 1, {
      ...original,
      progress: "Digitized",
      links: [],
    });

    try {
      const first = await addLink("IT12", { link: "https://example.org/first" });
      const second = await addLink("IT12", { link: "https://example.org/second" });
      const secondId = second.links.find((link) => !link.isPrimary)?.id;
      if (secondId === undefined) throw new Error("The second link is not primary");
      await replaceLink("IT12", secondId, { link: "https://example.org/replaced" });
      await makeLinkPrimary("IT12", secondId);
      await removeLink("IT12", secondId);

      expect(first.links[0]?.isPrimary).toBe(true);
      expect(eventEntries(database.statusLog.slice(logStart)).map((entry) => entry.code)).toEqual([
        "iteration.published",
        "iteration.link_added",
        "iteration.link_changed",
        "iteration.link_made_primary",
        "iteration.link_removed",
      ]);
      expect(
        database.hookDeliveries
          .slice(deliveryStart)
          .filter((delivery) => hookIds.includes(delivery.hookId))
          .map((delivery) => delivery.event),
      ).toEqual([
        "iteration.published",
        "iteration.link_added",
        "iteration.link_changed",
        "iteration.link_changed",
        "iteration.link_changed",
      ]);
    } finally {
      database.iterations.splice(iterationIndex, 1, original);
      database.hooks = database.hooks.filter((hook) => !hookIds.includes(hook.id));
      database.hookDeliveries = database.hookDeliveries.filter(
        (delivery) => !hookIds.includes(delivery.hookId),
      );
      database.statusLog.splice(logStart);
    }
  });
});

describe("ACT-resume", () => {
  it("lifts the hold and returns the item to the pool", async () => {
    signInAs("admin");

    const result = await resumeIteration("IT9");
    const detail = await findDocument("D9");
    const current = detail?.record.iterations.at(-1);

    expect(result.progress).toBe("Ready");
    expect(current?.cancellation).toBeNull();
    expect(current?.listId).toBeNull(); // LC-ITER-resume
    expect(eventEntry(detail?.log[0]).code).toBe("iteration.resumed");
    expect(await statusOf(resumeIteration("IT9"))).toBe(409); // no longer held
  });

  it("is not a reader's to do", async () => {
    signInAs("reader");

    expect(await statusOf(resumeIteration("IT9"))).toBe(404);
  });
});

describe("ACT-overrule", () => {
  it("is an administrator's only, never custody", async () => {
    signInAs("curator");

    expect(await statusOf(overruleRestriction("IT14", { note: "Rights cleared." }))).toBe(403);
  });

  it("lifts the restriction with a note and keeps the rule's finding", async () => {
    signInAs("admin");

    await overruleRestriction("IT14", { note: "Rights cleared in writing." });
    const detail = await findDocument("D14");
    const current = detail?.record.iterations.at(-1);

    expect(current?.restriction).not.toBeNull();
    expect(current?.restrictionOverride?.note).toBe("Rights cleared in writing.");
    expect(eventEntry(detail?.log[0]).code).toBe("iteration.restriction_overruled");
    expect(await statusOf(overruleRestriction("IT14", { note: "Again." }))).toBe(409);
  });
});
