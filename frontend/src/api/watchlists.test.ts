// Watchlists end to end: the caller's own and the shared ones on a view, and who may change a
// shared one, against the mock server over HTTP.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import {
  createWatchlist,
  deleteWatchlist,
  getWatchlistReach,
  listWatchlists,
  updateWatchlist,
} from "@/api/watchlists";
import type { MockUserProfile } from "@/config/env";
import { isShared } from "@/domain/entities";
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

    const shared = watchlists.map(isShared);
    expect(shared).toContain(true);
    expect(shared).toContain(false);
    expect(shared.indexOf(false)).toBeGreaterThan(shared.lastIndexOf(true));
  });

  it("lets staff change only their own", async () => {
    signInAs("staff");

    const watchlists = await listWatchlists("documents");

    expect(watchlists.every((watchlist) => watchlist.isEditable === !isShared(watchlist))).toBe(
      true,
    );
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
    expect(watchlists.every((watchlist) => !isShared(watchlist))).toBe(true);
  });
});

describe("changing a shared watchlist", () => {
  it("is refused without the permission", async () => {
    signInAs("staff");
    const [shared] = (await listWatchlists("documents")).filter(isShared);
    if (shared === undefined) {
      throw new Error("No shared watchlist in the fixtures");
    }

    expect(await statusOf(updateWatchlist(shared.id, { name: "Mine now" }))).toBe(403);
    expect(await statusOf(deleteWatchlist(shared.id))).toBe(403);
    expect(
      await statusOf(
        createWatchlist({
          name: "Ours",
          view: "documents",
          audience: { kind: "everyone" },
          filter: {},
        }),
      ),
    ).toBe(403);
  });

  it("is allowed with it, and everyone sees the result", async () => {
    signInAs("admin");
    const created = await createWatchlist({
      name: "Cancelled",
      view: "documents",
      audience: { kind: "everyone" },
      filter: { cancelled: "Yes" },
    });

    signInAs("staff");
    const seen = await listWatchlists("documents");

    expect(seen.some((watchlist) => watchlist.id === created.id)).toBe(true);

    signInAs("admin");
    await deleteWatchlist(created.id);
  });
});

describe("saving a filter twice", () => {
  it("is refused among the caller's own", async () => {
    signInAs("staff");

    expect(
      await statusOf(
        createWatchlist({
          name: "Urgent again",
          view: "documents",
          audience: { kind: "personal" },
          filter: { copy: "None", priority: "High,Urgent" },
        }),
      ),
    ).toBe(409);
  });

  it("is refused when a shared watchlist holds the filter", async () => {
    signInAs("staff");

    expect(
      await statusOf(
        createWatchlist({
          name: "My pending",
          view: "documents",
          audience: { kind: "personal" },
          filter: { decision: "Pending" },
        }),
      ),
    ).toBe(409);
  });

  it("is refused as shared while the caller keeps it as their own", async () => {
    signInAs("admin");

    expect(
      await statusOf(
        createWatchlist({
          name: "Review needed for all",
          view: "documents",
          audience: { kind: "everyone" },
          filter: { validation: "Needed" },
        }),
      ),
    ).toBe(409);
  });

  it("is refused when a change would make it the same as another", async () => {
    signInAs("staff");
    const [own] = (await listWatchlists("documents")).filter((watchlist) => !isShared(watchlist));
    if (own === undefined) {
      throw new Error("No personal watchlist in the fixtures");
    }

    expect(await statusOf(updateWatchlist(own.id, { filter: { forbidden: "Yes" } }))).toBe(409);
  });
});

describe("sharing a personal watchlist", () => {
  it("is refused without the permission", async () => {
    signInAs("staff");
    const [own] = (await listWatchlists("documents")).filter((watchlist) => !isShared(watchlist));
    if (own === undefined) {
      throw new Error("No personal watchlist in the fixtures");
    }

    expect(await statusOf(updateWatchlist(own.id, { audience: { kind: "everyone" } }))).toBe(403);
  });

  it("makes it the one everybody sees, in place of the caller's own", async () => {
    signInAs("admin");
    const created = await createWatchlist({
      name: "Cancelled",
      view: "documents",
      audience: { kind: "personal" },
      filter: { cancelled: "Yes" },
    });

    const shared = await updateWatchlist(created.id, { audience: { kind: "everyone" } });

    signInAs("staff");
    const seen = await listWatchlists("documents");

    expect(shared.audience).toEqual({ kind: "everyone" });
    expect(seen.some((watchlist) => watchlist.id === created.id)).toBe(true);

    signInAs("admin");
    await deleteWatchlist(created.id);
  });
});

describe("an audience of some groups and roles", () => {
  it("reaches the group's members and the role's holders who may open the view", async () => {
    const namesFor = async (view: "proposals" | "validations") =>
      (await listWatchlists(view)).map((watchlist) => watchlist.name);

    signInAs("curator");
    expect(await namesFor("proposals")).toContain("Periodicals");
    expect(await namesFor("validations")).toContain("Page counts");

    signInAs("admin");
    expect(await namesFor("proposals")).not.toContain("Periodicals");
    expect(await namesFor("validations")).not.toContain("Page counts");
  });

  it("says first how many it reaches, who cannot open the view, and who keeps the filter", async () => {
    signInAs("admin");

    expect(
      await getWatchlistReach({
        view: "proposals",
        filter: { decision: "Pending", askers: "Several" },
        audience: { kind: "some", groupIds: ["g1", "g3"], roleIds: [] },
        watchlistId: null,
      }),
    ).toEqual({ userCount: 2, outOfViewCount: 1, duplicateCount: 2 });
  });

  it("is refused empty", async () => {
    signInAs("admin");

    expect(
      await statusOf(
        createWatchlist({
          name: "Nobody's",
          view: "documents",
          audience: { kind: "some", groupIds: [], roleIds: [] },
          filter: { cancelled: "Yes" },
        }),
      ),
    ).toBe(422);
  });

  it("keeps each person's own row for a watchlist they see", async () => {
    signInAs("staff");
    const [first] = await listWatchlists("documents");

    expect(first?.viewer).toMatchObject({ seenAt: null, hasBadge: true, isHidden: false });
  });
});
