// Watchlists end to end: the caller's own and the shared ones on a view, and who may change a
// shared one, against the mock server over HTTP.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import {
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  updateWatchlist,
} from "@/api/watchlists";
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

describe("listWatchlists", () => {
  it("lists the shared ones first, then the caller's own", async () => {
    signInAs("staff");

    const watchlists = await listWatchlists("documents");

    const scopes = watchlists.map((watchlist) => watchlist.scope);
    expect(scopes).toContain("shared");
    expect(scopes).toContain("personal");
    expect(scopes.indexOf("personal")).toBeGreaterThan(scopes.lastIndexOf("shared"));
  });

  it("lets staff change only their own", async () => {
    signInAs("staff");

    const watchlists = await listWatchlists("documents");

    expect(
      watchlists.every((watchlist) => watchlist.isEditable === (watchlist.scope === "personal")),
    ).toBe(true);
  });

  it("lets an administrator change the shared ones too", async () => {
    signInAs("admin");

    const watchlists = await listWatchlists("documents");

    expect(watchlists.every((watchlist) => watchlist.isEditable)).toBe(true);
  });

  it("shows a reader no shared watchlist", async () => {
    signInAs("reader");

    const watchlists = await listWatchlists("documents");

    expect(watchlists.length).toBeGreaterThan(0);
    expect(watchlists.every((watchlist) => watchlist.scope === "personal")).toBe(true);
  });
});

describe("changing a shared watchlist", () => {
  it("is refused without the permission", async () => {
    signInAs("staff");
    const [shared] = (await listWatchlists("documents")).filter(
      (watchlist) => watchlist.scope === "shared",
    );
    if (shared === undefined) {
      throw new Error("No shared watchlist in the fixtures");
    }

    expect(await statusOf(updateWatchlist(shared.id, { name: "Mine now" }))).toBe(403);
    expect(await statusOf(deleteWatchlist(shared.id))).toBe(403);
    expect(
      await statusOf(
        createWatchlist({ name: "Ours", view: "documents", scope: "shared", filter: {} }),
      ),
    ).toBe(403);
  });

  it("is allowed with it, and everyone sees the result", async () => {
    signInAs("admin");
    const created = await createWatchlist({
      name: "Cancelled",
      view: "documents",
      scope: "shared",
      filter: { cancelled: "Yes" },
    });

    signInAs("staff");
    const seen = await listWatchlists("documents");

    expect(seen.some((watchlist) => watchlist.id === created.id)).toBe(true);

    signInAs("admin");
    await deleteWatchlist(created.id);
  });
});
