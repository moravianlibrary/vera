// User settings end to end: the tab each view was last left on and what the Categories tree
// shows, kept per person by the mock server over HTTP.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { getUserSettings, updateUserSettings } from "@/api/user-settings";
import type { MockUserProfile } from "@/config/env";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

describe("user settings", () => {
  it("keeps the tab last opened per view, null for All", async () => {
    signInAs("curator");

    await updateUserSettings({ lastOpenedWatchlists: { proposals: "W-shared-3" } });
    const settings = await updateUserSettings({ lastOpenedWatchlists: { documents: null } });

    expect(settings.lastOpenedWatchlists).toEqual({ proposals: "W-shared-3", documents: null });
    expect(await getUserSettings()).toEqual(settings);
  });

  it("keeps what the Categories tree shows beside the tabs", async () => {
    signInAs("digitization");

    await updateUserSettings({ lastOpenedWatchlists: { validations: null } });
    const settings = await updateUserSettings({ categoryTreeValue: "pages" });

    expect(settings).toEqual({
      lastOpenedWatchlists: { validations: null },
      categoryTreeValue: "pages",
    });
  });

  it("keeps each person's settings apart", async () => {
    signInAs("admin");
    await updateUserSettings({ lastOpenedWatchlists: { documents: "W-u3-documents-1" } });

    signInAs("staff");
    const settings = await getUserSettings();

    expect(settings.lastOpenedWatchlists.documents).toBeUndefined();
  });

  it("refuses a view that does not exist", async () => {
    signInAs("staff");

    const refused = await updateUserSettings({
      lastOpenedWatchlists: { nowhere: "W-1" } as never,
    }).catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(ApiError);
    expect((refused as ApiError).status).toBe(422);
  });

  it("keeps display choices and fixed opening tabs without clearing other settings", async () => {
    signInAs("reader");
    await updateUserSettings({ lastOpenedWatchlists: { documents: "W-reader-documents" } });
    const settings = await updateUserSettings({
      appearance: "dark",
      density: "compact",
      dateFormat: "iso",
      fixedOpeningWatchlists: { documents: null },
    });
    expect(settings).toMatchObject({
      lastOpenedWatchlists: { documents: "W-reader-documents" },
      appearance: "dark",
      density: "compact",
      dateFormat: "iso",
      fixedOpeningWatchlists: { documents: null },
    });
    expect(await getUserSettings()).toEqual(settings);
  });
});
