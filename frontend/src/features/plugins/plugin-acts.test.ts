// Plugin acts are offered from the instance state and the permissions the session holds.

import { describe, expect, it } from "vitest";
import type { PluginDialog } from "@/features/plugins/plugin-acts";
import { instanceActionsFor } from "@/features/plugins/plugin-acts";
import { pluginIndex } from "@/mocks/plugins";
import { resolveSession } from "@/mocks/session";

const index = pluginIndex();
const instance = index.instances.find(({ canReset }) => canReset);
if (instance === undefined) throw new Error("Missing resettable plugin fixture");
const implementation = index.implementations.find(({ id }) => id === instance.implementationId);
if (implementation === undefined) throw new Error("Missing plugin implementation fixture");

describe("instanceActionsFor reset", () => {
  it("offers Reset only when the instance can reset and the session can configure plugins", () => {
    const admin = resolveSession("admin");
    const reader = resolveSession("reader");
    const actionsFor = (canReset: boolean, session = admin) =>
      instanceActionsFor(session, { ...instance, canReset }, implementation, {
        open: () => {},
        onRun: () => {},
        onEnable: () => {},
      });

    expect(actionsFor(true).map(({ id }) => id)).toContain("reset");
    expect(actionsFor(false).map(({ id }) => id)).not.toContain("reset");
    expect(actionsFor(true, reader).map(({ id }) => id)).not.toContain("reset");
    const reset = actionsFor(true).find(({ id }) => id === "reset");
    expect(reset?.isPrimary).not.toBe(true);
    expect(reset?.isDestructive).not.toBe(true);
    expect(actionsFor(true).map(({ id }) => id)).toEqual(expect.arrayContaining(["edit", "reset"]));
    expect(actionsFor(true).findIndex(({ id }) => id === "reset")).toBe(
      actionsFor(true).findIndex(({ id }) => id === "edit") + 1,
    );
    const opened: PluginDialog[] = [];
    const resetAction = instanceActionsFor(admin, instance, implementation, {
      open: (dialog) => opened.push(dialog),
      onRun: () => {},
      onEnable: () => {},
    }).find(({ id }) => id === "reset");
    if (resetAction === undefined || !("onSelect" in resetAction)) {
      throw new Error("Missing reset action");
    }
    resetAction.onSelect();
    expect(opened).toEqual([{ kind: "reset", instanceId: instance.id }]);
  });
});
