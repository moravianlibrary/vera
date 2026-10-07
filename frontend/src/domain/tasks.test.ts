// Who may cancel a run or run it again: whoever started it, or a grant over everyone's.

import { describe, expect, it } from "vitest";
import type { Permission } from "@/domain/permissions";
import type { RunState } from "@/domain/tasks";
import { canCancelRun, canRunAgain } from "@/domain/tasks";

function holderWith(...permissions: Permission[]) {
  return {
    user: { id: "u8" },
    grants: permissions.map((permission) => ({ permission, scope: null })),
  };
}

const run = (state: RunState, startedBy: string | null, isRerunnable = true) => ({
  state,
  startedBy,
  isRerunnable,
});

describe("canCancelRun", () => {
  it("lets whoever started it cancel it, and task.cancel anyone's", () => {
    expect(canCancelRun(holderWith("task.read_own"), run("Running", "u8"))).toBe(true);
    expect(canCancelRun(holderWith("task.read_own"), run("Running", null))).toBe(false);
    expect(canCancelRun(holderWith("task.read", "task.cancel"), run("Running", null))).toBe(true);
  });

  it("is only for a run still going", () => {
    expect(canCancelRun(holderWith("task.cancel"), run("Done", "u8"))).toBe(false);
  });
});

describe("canRunAgain", () => {
  it("is for a failed or cancelled plugin run", () => {
    const holder = holderWith("plugin.run");

    expect(canRunAgain(holder, run("Failed", "u1"))).toBe(true);
    expect(canRunAgain(holder, run("Cancelled", "u1"))).toBe(true);
    expect(canRunAgain(holder, run("Done", "u1"))).toBe(false);
    expect(canRunAgain(holder, run("Failed", null, false))).toBe(false);
  });

  it("needs plugin.run unless it is the person's own", () => {
    expect(canRunAgain(holderWith("task.read_own"), run("Failed", "u8"))).toBe(true);
    expect(canRunAgain(holderWith("task.read_own"), run("Failed", "u1"))).toBe(false);
  });
});
