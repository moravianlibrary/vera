// The Hooks list's URL filters and subject groups remain stable for deep links.

import { describe, expect, it } from "vitest";
import type { HookIndex } from "@/api/hooks";
import { hookGroupOf, hooksView, shownHooksOf } from "@/features/hooks/hooks-view";
import { hookDeliveries, hooks } from "@/mocks/fixtures/hooks";

const index: HookIndex = {
  asOf: "2026-06-25T10:40:00.000Z",
  retentionDays: 30,
  hooks,
  deliveries: hookDeliveries,
  attempts: [],
  channels: [
    { id: "pi17", name: "Mailgun", interface: "Email", isEnabled: true },
    { id: "pi18", name: "Slack", interface: "Chat", isEnabled: true },
    { id: "pi19", name: "Teams", interface: "Chat", isEnabled: true },
    { id: "pi20", name: "Webhook", interface: "Webhook", isEnabled: true },
    { id: "pi21", name: "SFTP", interface: "File", isEnabled: true },
  ],
};

describe("Hooks view", () => {
  it("round trips filters while the selected hook stays a separate URL parameter", () => {
    const query = hooksView.parseSearchParams(
      new URLSearchParams("q=ops&kind=Webhook&state=gave_up&h=H-03"),
    );
    expect(query).toEqual({ search: "ops", kinds: ["Webhook"], states: ["gave_up"] });
    expect(hooksView.toSearchParams(query).toString()).toBe("q=ops&kind=Webhook&state=gave_up");
  });

  it("groups by subject and finds hooks with exhausted deliveries", () => {
    expect(hookGroupOf(hooks[0])).toBe("Records");
    expect(shownHooksOf(index, { states: ["gave_up"] }).map((hook) => hook.id)).toEqual(["H-03"]);
    expect(shownHooksOf(index, { kinds: ["Email"] }).map((hook) => hook.id)).toEqual(["H-02"]);
  });
});
