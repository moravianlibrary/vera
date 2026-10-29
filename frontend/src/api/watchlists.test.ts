// Watchlists end to end: the caller's own and the shared ones on a view, and who may change a
// shared one, against the mock server over HTTP.

import { parseCategorySearchParams } from "@vera/contract/categories";
import { matchingCategoryIds } from "@vera/contract/category-filters";
import { parseIntentionsSearchParams } from "@vera/contract/intention-filters";
import { parseRunSearchParams } from "@vera/contract/tasks";
import { isShared } from "@vera/domain/entities";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getCategoryIndex } from "@/api/categories";
import { listDocuments } from "@/api/documents";
import { ApiError } from "@/api/http";
import { listIntentionIndex } from "@/api/intentions";
import { listLists } from "@/api/lists";
import { listProjectIndex } from "@/api/projects";
import { getPushDevices, registerPushDevice } from "@/api/push";
import { listRuns } from "@/api/tasks";
import {
  createWatchlist,
  deleteWatchlist,
  getWatchlistReach,
  listWatchlists,
  markWatchlistSeen,
  updateWatchlist,
  updateWatchlistViewer,
} from "@/api/watchlists";
import type { MockUserProfile } from "@/config/env";
import { matchingIntentions } from "@/features/intentions/intentions-board-view";
import { database } from "@/mocks/database";
import { categories } from "@/mocks/fixtures/categories";
import { createHandlers } from "@/mocks/handlers";
import { forgetPushDevices } from "@/mocks/push";
import { changeUserSettings } from "@/mocks/user-settings";
import {
  flushWatchlistChat,
  flushWatchlistMail,
  flushWatchlistPush,
  watchlistChatOutbox,
  watchlistMailOutbox,
} from "@/mocks/watchlist-delivery";

// Reconciling every watchlist is slow under the full suite's load; the default 5 s is not enough.
vi.setConfig({ testTimeout: 20_000 });

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
  it("keeps staff and requester watchlists in separate views and counts own records", async () => {
    signInAs("admin");
    const staff = await listWatchlists("documents");
    const mine = await listWatchlists("my-documents");
    expect(staff.some((item) => item.name === "Waiting for review")).toBe(false);
    expect(mine.some((item) => item.name === "Waiting for review")).toBe(true);
    expect(mine.some((item) => item.name === "Awaiting a decision")).toBe(false);
    const ownWaiting = await listDocuments(
      { statuses: ["WaitingForReview"] },
      { perspective: "my" },
    );
    expect(mine.find((item) => item.name === "Waiting for review")?.itemCount).toBe(
      ownWaiting.total,
    );

    signInAs("reader");
    const readerMine = await listWatchlists("my-documents");
    expect(readerMine.some((item) => item.name === "Waiting for review" && isShared(item))).toBe(
      true,
    );
    expect(readerMine.some((item) => item.name === "Ready to read" && !isShared(item))).toBe(true);
    expect(await listWatchlists("documents")).toEqual([]);
  });

  it("batches new entries and drops entries opened before mail is sent", async () => {
    signInAs("admin");
    const watchlist = await createWatchlist({
      name: "Mail entry test",
      view: "documents",
      audience: { kind: "personal" },
      filter: { q: "mail-entry-unique" },
    });
    const original = database.documents[0];
    const second = database.documents[1];
    expect(original).toBeDefined();
    expect(second).toBeDefined();
    if (original === undefined || second === undefined) return;
    try {
      await listWatchlists("documents");
      await updateWatchlistViewer(watchlist.id, { channels: { pi16: true } });
      database.documents[0] = { ...original, title: `${original.title} mail-entry-unique` };
      await listWatchlists("documents");
      const future = new Date(Date.now() + 16 * 60_000);
      const sent = flushWatchlistMail(future);
      expect(
        sent
          .filter((mail) => mail.userId === "u3")
          .flatMap((mail) => mail.records)
          .some((record) => record.watchlistIds.includes(watchlist.id)),
      ).toBe(true);
      expect(
        flushWatchlistMail(new Date(future.getTime() + 60_000))
          .flatMap((mail) => mail.records)
          .some((record) => record.watchlistIds.includes(watchlist.id)),
      ).toBe(false);
      expect(watchlistMailOutbox.at(-1)?.manageUrl).toBe("/preferences/watchlists");
      database.documents[1] = { ...second, title: `${second.title} mail-entry-unique` };
      await listWatchlists("documents");
      await markWatchlistSeen(watchlist.id);
      expect(
        flushWatchlistMail(new Date(future.getTime() + 32 * 60_000))
          .flatMap((mail) => mail.records)
          .some((record) => record.watchlistIds.includes(watchlist.id)),
      ).toBe(false);
    } finally {
      database.documents[0] = original;
      database.documents[1] = second;
      await deleteWatchlist(watchlist.id);
    }
  });
  it("sends each channel instance its own, and nothing while it is off for all (WATCH-channel-off)", async () => {
    signInAs("admin");
    const watchlist = await createWatchlist({
      name: "Chat entry test",
      view: "documents",
      audience: { kind: "personal" },
      filter: { q: "chat-entry-unique" },
    });
    const original = database.documents[0];
    if (original === undefined) return;
    try {
      await listWatchlists("documents");
      await updateWatchlistViewer(watchlist.id, { channels: { pi18: true } });
      changeUserSettings("u3", {
        notifications: { doNotSend: false, hooks: {}, channelsOff: ["pi18"] },
      });
      database.documents[0] = { ...original, title: `${original.title} chat-entry-unique` };
      await listWatchlists("documents");
      const sentTo = () =>
        watchlistChatOutbox
          .filter((chat) => chat.watchlistId === watchlist.id)
          .map((chat) => chat.channelId);
      flushWatchlistChat();
      expect(sentTo()).toEqual([]);
      changeUserSettings("u3", { notifications: { doNotSend: false, hooks: {}, channelsOff: [] } });
      flushWatchlistChat();
      expect(sentTo()).toEqual(["pi18"]);
    } finally {
      database.documents[0] = original;
      await deleteWatchlist(watchlist.id);
    }
  });
  it("pushes what entered to a browser allowed, batched in seconds (WATCH-push)", async () => {
    signInAs("admin");
    const watchlist = await createWatchlist({
      name: "Push entry test",
      view: "documents",
      audience: { kind: "personal" },
      filter: { q: "push-entry-unique" },
    });
    const original = database.documents[0];
    if (original === undefined) return;
    const pushesFor = (sent: ReturnType<typeof flushWatchlistPush>) =>
      sent.filter((push) => push.watchlistId === watchlist.id);
    try {
      await listWatchlists("documents");
      const entering = async () => {
        database.documents[0] = { ...original, title: `${original.title} push-entry-unique` };
        await listWatchlists("documents");
      };

      // Nothing is pushed before a browser is allowed.
      await entering();
      expect(pushesFor(flushWatchlistPush(new Date(Date.now() + 60_000)))).toEqual([]);
      database.documents[0] = original;
      await listWatchlists("documents");

      expect((await getPushDevices()).deviceCount).toBe(0);
      const devices = await registerPushDevice({
        endpoint: "https://push.example/browser-1",
        keys: { p256dh: "key", auth: "secret" },
      });
      expect(devices.deviceCount).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await entering();
      const enteredAt = Date.now();

      expect(pushesFor(flushWatchlistPush(new Date(enteredAt + 1_000)))).toEqual([]);
      const [push] = pushesFor(flushWatchlistPush(new Date(enteredAt + 6_000)));
      expect(push).toMatchObject({ title: "Push entry test", body: database.documents[0]?.title });
      expect(pushesFor(flushWatchlistPush(new Date(enteredAt + 60_000)))).toEqual([]);

      // Do not send notifications stops push too (WATCH-do-not-send).
      database.documents[0] = original;
      await listWatchlists("documents");
      changeUserSettings("u3", { notifications: { doNotSend: true, hooks: {} } });
      await entering();
      expect(pushesFor(flushWatchlistPush(new Date(Date.now() + 60_000)))).toEqual([]);
    } finally {
      changeUserSettings("u3", { notifications: { doNotSend: false, hooks: {} } });
      forgetPushDevices();
      database.documents[0] = original;
      await deleteWatchlist(watchlist.id);
    }
  });

  it("counts entries since opening without treating existing matches as new", async () => {
    signInAs("admin");
    const watchlist = await createWatchlist({
      name: "Entry test",
      view: "documents",
      audience: { kind: "personal" },
      filter: { q: "entry-test-unique" },
    });
    const original = database.documents[0];
    expect(original).toBeDefined();
    if (original === undefined) return;
    try {
      expect(
        (await listWatchlists("documents")).find((row) => row.id === watchlist.id)?.newCount,
      ).toBe(0);
      database.documents[0] = { ...original, title: `${original.title} entry-test-unique` };
      expect(
        (await listWatchlists("documents")).find((row) => row.id === watchlist.id)?.newCount,
      ).toBe(1);
      await markWatchlistSeen(watchlist.id);
      expect(
        (await listWatchlists("documents")).find((row) => row.id === watchlist.id)?.newCount,
      ).toBe(0);
    } finally {
      database.documents[0] = original;
      await deleteWatchlist(watchlist.id);
    }
  });
  it("keeps each person's order on system watchlists", async () => {
    signInAs("admin");
    const [first, second] = (await listWatchlists("documents")).filter(isShared);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    signInAs("curator");
    const curatorPosition = (await listWatchlists("documents")).find((item) => item.id === first.id)
      ?.viewer.position;
    signInAs("admin");
    await updateWatchlistViewer(first.id, {
      position: second.viewer.position,
    });
    await updateWatchlistViewer(second.id, { position: first.viewer.position });
    const mine = await listWatchlists("documents");
    expect(mine.findIndex((item) => item.id === second.id)).toBeLessThan(
      mine.findIndex((item) => item.id === first.id),
    );
    signInAs("curator");
    const others = await listWatchlists("documents");
    expect(others.find((item) => item.id === first.id)?.viewer.position).toBe(curatorPosition);
    signInAs("admin");
    await updateWatchlistViewer(first.id, {
      position: first.viewer.position,
    });
    await updateWatchlistViewer(second.id, { position: second.viewer.position });
  });
  it("reads a selected independent mix for Categories", async () => {
    signInAs("admin");
    const overall = await getCategoryIndex();
    const selected = await getCategoryIndex("d2");

    expect(overall.mix?.mixId).toBe("d1");
    expect(selected.mix?.mixId).toBe("d2");
    expect(selected.mix?.intention.scopeCategoryId).toBeNull();
  });
  it("counts Categories tabs by matching categories rather than their ancestor rows", async () => {
    signInAs("admin");
    const index = await getCategoryIndex();
    const watchlists = await listWatchlists("categories");

    expect(watchlists.map((row) => row.name)).toEqual(["Without custody", "Mix gaps"]);
    for (const watchlist of watchlists) {
      expect(watchlist.itemCount).toBe(
        matchingCategoryIds(
          categories,
          index,
          parseCategorySearchParams(new URLSearchParams(watchlist.filter)),
        ).size,
      );
    }
  });
  it("counts the shared Projects tabs over each reader's reach", async () => {
    signInAs("curator");
    const proposed = (await listWatchlists("projects")).find(
      (watchlist) => watchlist.name === "Proposed",
    );
    expect(proposed?.itemCount).toBe((await listProjectIndex({ states: ["Proposed"] })).total);

    signInAs("reader");
    expect(await listWatchlists("projects")).toEqual([]);
  });
  it("counts the Targets, Output and Repeats tabs over visible intentions", async () => {
    signInAs("admin");
    const index = await listIntentionIndex();
    const watchlists = await listWatchlists("intentions");
    expect(watchlists.map((row) => row.name)).toEqual(["Repeats", "Targets", "Output"]);
    for (const watchlist of watchlists) {
      const matching = matchingIntentions(
        index,
        parseIntentionsSearchParams(new URLSearchParams(watchlist.filter)),
      );
      expect(watchlist.itemCount).toBe(matching.rows.length + matching.templates.length);
    }

    signInAs("reader");
    expect(await listWatchlists("intentions")).toEqual([]);
  });
  it("counts Running and recent failures as Tasks watchlists", async () => {
    signInAs("admin");
    const watchlists = await listWatchlists("tasks");
    expect(watchlists.map((row) => row.name)).toEqual(["Running", "Failed in last 7 days"]);
    for (const watchlist of watchlists) {
      const index = await listRuns(parseRunSearchParams(new URLSearchParams(watchlist.filter)));
      expect(watchlist.itemCount).toBe(index.running.length + index.finished.length);
    }

    signInAs("reader");
    expect(await listWatchlists("tasks")).toEqual([]);
  });
  it("counts the Current Lists tab from its saved state filter and scopes it to readers", async () => {
    signInAs("digitization");
    const current = (await listWatchlists("lists")).find(
      (watchlist) => watchlist.name === "Current",
    );
    expect(current?.filter).toEqual({ state: "Planned,InProgress" });
    expect(current?.itemCount).toBe((await listLists({ states: ["Planned", "InProgress"] })).total);

    signInAs("curator");
    expect(await listWatchlists("lists")).toEqual([]);
  });
  it("lists the shared ones first, then the caller's own", async () => {
    signInAs("curator");

    const watchlists = await listWatchlists("documents");

    const shared = watchlists.map(isShared);
    expect(shared).toContain(true);
    expect(shared).toContain(false);
    expect(shared.indexOf(false)).toBeGreaterThan(shared.lastIndexOf(true));
  });

  it("lets a curator change only their own", async () => {
    signInAs("curator");

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

  it("shows a reader no staff watchlist", async () => {
    signInAs("reader");

    const watchlists = await listWatchlists("documents");

    expect(watchlists).toEqual([]);
  });
});

describe("changing a shared watchlist", () => {
  it("lets a manager publish a requester watchlist but rejects the other view's fields", async () => {
    signInAs("admin");
    expect(
      await statusOf(
        createWatchlist({
          name: "Wrong requester filter",
          view: "my-documents",
          audience: { kind: "everyone" },
          filter: { decision: "Pending" },
        }),
      ),
    ).toBe(422);
    expect(
      await statusOf(
        createWatchlist({
          name: "Wrong staff filter",
          view: "documents",
          audience: { kind: "everyone" },
          filter: { status: "Available" },
        }),
      ),
    ).toBe(422);

    const created = await createWatchlist({
      name: "Available to requesters",
      view: "my-documents",
      audience: { kind: "everyone" },
      filter: { status: "Available" },
    });
    try {
      signInAs("reader");
      expect((await listWatchlists("my-documents")).some((item) => item.id === created.id)).toBe(
        true,
      );
      expect((await listWatchlists("documents")).some((item) => item.id === created.id)).toBe(
        false,
      );
    } finally {
      signInAs("admin");
      await deleteWatchlist(created.id);
    }
  });

  it("requires access to the source perspective when creating a watchlist", async () => {
    signInAs("reader");
    expect(
      await statusOf(
        createWatchlist({
          name: "Staff view",
          view: "documents",
          audience: { kind: "personal" },
          filter: { decision: "Pending" },
        }),
      ),
    ).toBe(403);
    expect(await listWatchlists("documents")).toEqual([]);
  });

  it("is refused without the permission", async () => {
    signInAs("curator");
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

    signInAs("curator");
    const seen = await listWatchlists("documents");

    expect(seen.some((watchlist) => watchlist.id === created.id)).toBe(true);

    signInAs("admin");
    await deleteWatchlist(created.id);
  });
});

describe("saving a filter twice", () => {
  it("is refused among the caller's own", async () => {
    signInAs("curator");

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
    signInAs("curator");

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

  it("saves one personal copy of a visible system watchlist without changing the source", async () => {
    signInAs("curator");
    const source = (await listWatchlists("documents")).find(
      (row) => isShared(row) && row.filter.decision === "Pending",
    );
    if (!source) throw new Error("Expected the Pending system watchlist");
    const draft = {
      name: "My pending copy",
      view: source.view,
      filter: source.filter,
      audience: { kind: "personal" as const },
      copyOf: source.id,
    };
    const copy = await createWatchlist(draft);
    try {
      expect(copy.audience.kind).toBe("personal");
      expect(copy.id).not.toBe(source.id);
      expect((await updateWatchlist(copy.id, { name: "My pending copy renamed" })).name).toBe(
        "My pending copy renamed",
      );
      expect(await statusOf(createWatchlist(draft))).toBe(409);
      expect(await statusOf(createWatchlist({ ...draft, copyOf: "not-a-watchlist" }))).toBe(422);
      expect((await listWatchlists("documents")).some((row) => row.id === source.id)).toBe(true);
    } finally {
      await deleteWatchlist(copy.id);
    }
  });

  it("publishes a system copy while the caller keeps their personal watchlist", async () => {
    signInAs("admin");
    const published = await createWatchlist({
      name: "Review needed for all",
      view: "documents",
      audience: { kind: "everyone" },
      filter: { validation: "Needed" },
    });
    expect(
      (await listWatchlists("documents")).some(
        (row) => row.name === "Review needed" && !isShared(row),
      ),
    ).toBe(true);
    expect(published.audience.kind).toBe("everyone");
    await deleteWatchlist(published.id);
  });

  it("is refused when a change would make it the same as another", async () => {
    signInAs("curator");
    const [own] = (await listWatchlists("documents")).filter((watchlist) => !isShared(watchlist));
    if (own === undefined) {
      throw new Error("No personal watchlist in the fixtures");
    }

    expect(await statusOf(updateWatchlist(own.id, { filter: { forbidden: "Yes" } }))).toBe(409);
  });
});

describe("publishing a personal watchlist", () => {
  it("is refused without the permission", async () => {
    signInAs("curator");
    const [own] = (await listWatchlists("documents")).filter((watchlist) => !isShared(watchlist));
    if (own === undefined) {
      throw new Error("No personal watchlist in the fixtures");
    }

    expect(await statusOf(updateWatchlist(own.id, { audience: { kind: "everyone" } }))).toBe(403);
  });

  it("keeps the personal copy when a system copy is published", async () => {
    signInAs("admin");
    const created = await createWatchlist({
      name: "Cancelled",
      view: "documents",
      audience: { kind: "personal" },
      filter: { cancelled: "Yes" },
    });

    expect(await statusOf(updateWatchlist(created.id, { audience: { kind: "everyone" } }))).toBe(
      409,
    );
    const shared = await createWatchlist({
      name: created.name,
      view: created.view,
      filter: created.filter,
      audience: { kind: "everyone" },
    });

    signInAs("curator");
    const seen = await listWatchlists("documents");

    expect(shared.audience).toEqual({ kind: "everyone" });
    expect(seen.some((watchlist) => watchlist.id === shared.id)).toBe(true);

    signInAs("admin");
    expect(
      (await listWatchlists("documents")).some((watchlist) => watchlist.id === created.id),
    ).toBe(true);
    await deleteWatchlist(shared.id);
    await deleteWatchlist(created.id);
  });
});

describe("an audience of some groups and roles", () => {
  it("reaches the group's members and the role's holders who may open the view", async () => {
    const namesFor = async (view: "requests" | "validations") =>
      (await listWatchlists(view)).map((watchlist) => watchlist.name);

    signInAs("curator");
    expect(await namesFor("requests")).toContain("Periodicals");
    expect(await namesFor("validations")).toContain("Page counts");

    signInAs("admin");
    expect(await namesFor("requests")).toContain("Periodicals");
    expect(await namesFor("validations")).toContain("Page counts");
  });

  it("says first how many it reaches, who cannot open the view, and who keeps the filter", async () => {
    signInAs("admin");

    expect(
      await getWatchlistReach({
        view: "requests",
        filter: { decision: "Pending", askers: "Several" },
        audience: { kind: "some", groupIds: ["g1", "g3"], roleIds: [] },
        watchlistId: null,
      }),
    ).toEqual({ userCount: 3, outOfViewCount: 1, duplicateCount: 3 });
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
    signInAs("curator");
    const [first] = await listWatchlists("documents");

    expect(first?.viewer).toMatchObject({ seenAt: null });
  });
});
