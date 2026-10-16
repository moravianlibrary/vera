// Hooks over HTTP: reach, channel references, preview versus test, delivery
// transitions and plugin impact (STATUS "Hooks"; plugins.md §4.12).

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createHook,
  deleteHook,
  discardDelivery,
  getHookIndex,
  pauseHook,
  previewHook,
  resumeHook,
  retryDelivery,
  retryHookDeliveries,
  saveHook,
  sendHookNow,
  sendHookTest,
} from "@/api/hooks";
import { ApiError } from "@/api/http";
import {
  getPublicNotificationPreferences,
  updatePublicNotificationPreferences,
} from "@/api/notification-preferences";
import {
  disablePluginInstance,
  enablePluginInstance,
  getPluginImpact,
  getPluginIndex,
} from "@/api/plugins";
import type { MockUserProfile } from "@/config/env";
import { database } from "@/mocks/database";
import { hookDeliveries } from "@/mocks/fixtures/hooks";
import { createHandlers } from "@/mocks/handlers";
import { issueNotificationToken } from "@/mocks/notification-tokens";
import { changeUserSettings, userSettingsOf } from "@/mocks/user-settings";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const signInAs = (profile: MockUserProfile) => server.use(...createHandlers(profile));
const refusalOf = async (request: Promise<unknown>) => {
  try {
    await request;
    return null;
  } catch (error) {
    return error instanceof ApiError ? { status: error.status, code: error.problem?.code } : null;
  }
};

const draft = {
  name: "A new hook",
  event: "task.failed" as const,
  filter: "",
  channelId: "pi18",
  recipient: "#digitalizace",
  message: "{task} failed: {error}",
  batch: null,
  retry: { attempts: 3, backoff: "fixed" as const },
};

describe("Hooks", () => {
  it("gates reads and writes by hook permissions", async () => {
    signInAs("reader");
    expect(await refusalOf(getHookIndex())).toMatchObject({ status: 403 });
    expect(await refusalOf(previewHook(draft))).toMatchObject({ status: 403 });
    expect(await refusalOf(sendHookTest(draft))).toMatchObject({ status: 403 });
    expect(await refusalOf(createHook(draft))).toMatchObject({ status: 403 });
  });

  it("lists subscriptions, exhausted and waiting deliveries, and live channel instances", async () => {
    signInAs("admin");
    const index = await getHookIndex();
    expect(index.hooks.find((hook) => hook.id === "H-02")?.batch).toMatchObject({
      waitMinutes: 15,
      maxMinutes: 60,
      by: "recipient",
    });
    expect(
      index.deliveries.filter(
        (delivery) => delivery.hookId === "H-03" && delivery.state === "gave_up",
      ),
    ).toHaveLength(2);
    expect(index.channels.find((channel) => channel.id === "pi20")).toMatchObject({
      interface: "Webhook",
      isEnabled: true,
    });
  });

  it("previews public words without a send, and sends only on the test action", async () => {
    signInAs("admin");
    const before = await getHookIndex();
    const preview = await previewHook(draft);
    expect(preview.publicText).toContain("Sample task");
    expect(preview.publicText).not.toContain("xoxb-");
    expect((await getHookIndex()).attempts).toEqual(before.attempts);
    expect(await sendHookTest(draft)).toMatchObject({ sent: true });
    expect((await getHookIndex()).attempts).toEqual(before.attempts);
  });

  it("validates channels, creates, edits, pauses, resumes and removes a hook", async () => {
    signInAs("admin");
    expect(await refusalOf(createHook({ ...draft, channelId: "pi4" }))).toMatchObject({
      status: 422,
      code: "hook.channel_unavailable",
    });
    const created = await createHook(draft);
    expect(created.state).toBe("active");
    expect((await pauseHook(created.id, "Maintenance")).pause?.reason).toBe("Maintenance");
    expect(await refusalOf(pauseHook(created.id, "Again"))).toMatchObject({ status: 409 });
    expect((await resumeHook(created.id)).state).toBe("active");
    expect((await saveHook(created.id, { ...draft, name: "Renamed" })).name).toBe("Renamed");
    await deleteHook(created.id);
    expect((await getHookIndex()).hooks.some((hook) => hook.id === created.id)).toBe(false);
  });

  it("retries and discards only exhausted deliveries; Send now flushes waiting ones", async () => {
    signInAs("admin");
    expect(await refusalOf(discardDelivery("HD-21"))).toMatchObject({
      status: 409,
      code: "hook.not_exhausted",
    });
    expect((await retryDelivery("DL-14")).state).toBe("waiting");
    expect((await discardDelivery("DL-13")).state).toBe("discarded");
    const sent = await sendHookNow("H-02");
    expect(sent.map((delivery) => delivery.state)).toEqual(["sent", "sent"]);
    expect(
      (await getHookIndex()).attempts.some(
        (attempt) => attempt.deliveryId === "HD-21" && attempt.result === "sent",
      ),
    ).toBe(true);
  });

  it("retries every exhausted delivery of one hook without touching another hook", async () => {
    signInAs("admin");
    database.hookDeliveries.push({ ...hookDeliveries[0], id: "DL-TEST-ALL", state: "gave_up" });
    const retried = await retryHookDeliveries("H-03");
    expect(retried.map((delivery) => delivery.id)).toEqual(["DL-TEST-ALL"]);
    expect(
      (await getHookIndex()).deliveries.find((delivery) => delivery.id === "HD-21")?.state,
    ).toBe("sent");
    database.hookDeliveries.splice(
      database.hookDeliveries.findIndex((delivery) => delivery.id === "DL-TEST-ALL"),
      1,
    );
  });

  it("counts dependent hooks in Plugins and stops pending sends while disabled", async () => {
    signInAs("admin");
    expect((await getPluginImpact("pi17")).hookCount).toBeGreaterThan(0);
    expect(
      (await getPluginIndex()).instances.find((instance) => instance.id === "pi17")?.hooks,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: "H-02" })]));
    await disablePluginInstance("pi17");
    expect(
      (await getHookIndex()).channels.find((channel) => channel.id === "pi17")?.isEnabled,
    ).toBe(false);
    await enablePluginInstance("pi17");
  });

  it("lets a recipient disable a Hook from a limited email link and suppresses delivery", async () => {
    signInAs("admin");
    const original = userSettingsOf("u5").notifications;
    const token = issueNotificationToken("u5", "H-02");
    const before = await getPublicNotificationPreferences(token);
    expect(before.email).toBe("tomas.marek@muni.cz");
    expect(before.hooks.map((hook) => hook.id)).toContain("H-02");
    const fixture = hookDeliveries.find((row) => row.id === "HD-22");
    expect(fixture).toBeDefined();
    if (fixture === undefined) return;
    const delivery = { ...fixture, id: "HD-PREF-TEST", state: "waiting" as const };
    database.hookDeliveries.push(delivery);
    try {
      await updatePublicNotificationPreferences(token, {
        doNotSend: false,
        hooks: { ...before.notifications.hooks, "H-02": false },
      });
      const result = await sendHookNow("H-02");
      expect(result.find((row) => row.id === delivery.id)?.state).toBe("suppressed");
      expect(database.hookAttempts.some((attempt) => attempt.deliveryId === delivery.id)).toBe(
        false,
      );
    } finally {
      database.hookDeliveries.splice(
        database.hookDeliveries.findIndex((row) => row.id === delivery.id),
        1,
      );
      changeUserSettings("u5", {
        notifications: original ?? { doNotSend: false, hooks: { "H-02": true } },
      });
    }
  });

  it("suppresses every hook's email under No hook email (WATCH-channel-off)", async () => {
    signInAs("admin");
    const original = userSettingsOf("u5").notifications;
    const fixture = hookDeliveries.find((row) => row.id === "HD-22");
    if (fixture === undefined) return;
    const delivery = { ...fixture, id: "HD-NO-HOOK-EMAIL", state: "waiting" as const };
    database.hookDeliveries.push(delivery);
    try {
      changeUserSettings("u5", {
        notifications: { doNotSend: false, hooks: { "H-02": true }, noHookEmail: true },
      });
      const result = await sendHookNow("H-02");
      expect(result.find((row) => row.id === delivery.id)?.state).toBe("suppressed");
    } finally {
      database.hookDeliveries.splice(
        database.hookDeliveries.findIndex((row) => row.id === delivery.id),
        1,
      );
      changeUserSettings("u5", {
        notifications: original ?? { doNotSend: false, hooks: { "H-02": true } },
      });
    }
  });
});
