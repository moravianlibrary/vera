// What switching an instance off is said to stop: the last of its kind says what disappears, one
// among others says the others stay; and when an instance is offered a newer version to move to.

import type { PluginImpact } from "@vera/contract/plugins";
import { describe, expect, it } from "vitest";
import { newerVersionOf } from "@/features/plugins/plugin-acts";
import { lossText } from "@/features/plugins/plugin-words";
import { pluginIndex } from "@/mocks/plugins";

const impact = (patch: Partial<PluginImpact>): PluginImpact => ({
  kind: "ListGenerator",
  otherEnabledCount: 0,
  scheduleCount: 0,
  runCount: 0,
  userCount: 0,
  openProposalCount: 0,
  hookCount: 0,
  hooks: [],
  ...patch,
});

describe("lossText", () => {
  it("says the last generator takes Generate with it, and one of several does not", () => {
    expect(lossText(impact({}), "Pilot")).toMatch(/last generator: the Generate button disappears/);
    expect(lossText(impact({ otherEnabledCount: 1 }), "Pilot")).toMatch(/other generators stay/);
  });

  it("counts who signs in through an identity", () => {
    expect(lossText(impact({ kind: "Identity", userCount: 1 }), "eduID.cz")).toMatch(
      /1 person signs in through it/,
    );
  });

  it("counts the hooks a channel stops, and names them to whoever may read hooks (PLG-delivery-hooks)", () => {
    const hooks = [
      { id: "h1", name: "Notify Kramerius on publish" },
      { id: "h3", name: "Ops channel on ingest failure" },
    ];

    expect(lossText(impact({ kind: "DeliveryChannel", hookCount: 2 }), "Slack")).toMatch(
      /^2 active hooks sending through it stop;/,
    );
    expect(lossText(impact({ kind: "DeliveryChannel", hookCount: 2, hooks }), "Slack")).toMatch(
      /stop — Notify Kramerius on publish, Ops channel on ingest failure;/,
    );
    expect(lossText(impact({ kind: "DeliveryChannel" }), "Slack")).toBe(
      "no active hook sends through it.",
    );
  });
});

describe("newerVersionOf", () => {
  const index = pluginIndex();
  const implementation = index.implementations.find((candidate) => candidate.id === "pt6");
  const instance = index.instances.find((candidate) => candidate.id === "pi9");

  it("offers the newest version VERA can run, never one for another contract", () => {
    const current = implementation?.versions[0];
    if (implementation === undefined || instance === undefined || current === undefined) {
      throw new Error("CatalogValidity and its ruleset are in the fixtures");
    }

    expect(newerVersionOf(instance, implementation)).toBeNull();
    const withNewer = {
      ...implementation,
      versions: [
        { ...current, version: "4.0.0", contractVersion: "2.0" },
        { ...current, version: "3.2.0" },
        current,
      ],
    };
    expect(newerVersionOf(instance, withNewer)).toBe("3.2.0");
  });
});
