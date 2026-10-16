// A watchlist's channels are browser push and every enabled Delivery channel instance that can
// reach the person, named by the instance (WATCH-delivery); one kind can be switched off for every
// watchlist, and No hook email for every hook (WATCH-channel-off).

import { describe, expect, it } from "vitest";
import { database } from "@/mocks/database";
import { changeUserSettings } from "@/mocks/user-settings";
import { isChannelOffForAll, watchlistChannelsOf } from "@/mocks/watchlist-channels";

describe("watchlist channels", () => {
  it("are the person-reaching Delivery channel instances, by name", () => {
    const channels = watchlistChannelsOf("u2");
    expect(channels.map((channel) => channel.name)).toEqual([
      "MZK SMTP",
      "Mailgun — requesters",
      "MZK Slack",
      "MZK Teams",
    ]);
    expect(channels.find((channel) => channel.name === "MZK Slack")).toMatchObject({
      reach: { by: "claim", claim: "slack_id" },
      canReach: true,
    });
    // Nobody's login gives a teams_upn yet.
    expect(channels.find((channel) => channel.name === "MZK Teams")?.canReach).toBe(false);
  });

  it("leave out an instance switched off, and one that reaches no person", () => {
    const instances = database.pluginInstances;
    database.pluginInstances = instances.map((instance) =>
      instance.id === "pi18" ? { ...instance, isEnabled: false } : instance,
    );
    try {
      expect(watchlistChannelsOf("u2").map((channel) => channel.id)).not.toContain("pi18");
      expect(watchlistChannelsOf("u2").map((channel) => channel.id)).not.toContain("pi20");
    } finally {
      database.pluginInstances = instances;
    }
  });

  it("can each be switched off for every watchlist, and Do not send stops all", () => {
    changeUserSettings("u2", {
      notifications: { doNotSend: false, hooks: {}, channelsOff: ["pi18"] },
    });
    expect(isChannelOffForAll("u2", "pi18")).toBe(true);
    expect(isChannelOffForAll("u2", "pi16")).toBe(false);
    changeUserSettings("u2", { notifications: { doNotSend: true, hooks: {} } });
    expect(isChannelOffForAll("u2", "pi16")).toBe(true);
    changeUserSettings("u2", { notifications: { doNotSend: false, hooks: {}, channelsOff: [] } });
  });
});
