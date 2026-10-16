// can(): a grant's scope against the record an action is about.

import { describe, expect, it } from "bun:test";
import type { Grant, ScopeHolder } from "./permissions";
import { can } from "./permissions";

function holderWith(grants: Grant[], custodyCategoryIds: string[] = []): ScopeHolder {
  return { user: { id: "U1" }, grants, custodyCategoryIds, groupIds: ["G1"] };
}

describe("can", () => {
  it("asks only for the grant when there is no record", () => {
    const holder = holderWith([{ permission: "list.create", scope: null }]);

    expect(can(holder, "list.create")).toBe(true);
    expect(can(holder, "list.delete")).toBe(false);
  });

  it("reaches an iteration in custody of any of its ancestors", () => {
    const holder = holderWith([{ permission: "iteration.classify", scope: "custody" }], ["c1"]);

    expect(
      can(holder, "iteration.classify", { kind: "iteration", categoryPathIds: ["c1", "c11"] }),
    ).toBe(true);
    expect(can(holder, "iteration.classify", { kind: "iteration", categoryPathIds: ["c2"] })).toBe(
      false,
    );
  });

  it("takes the widest scope across the holder's grants", () => {
    const holder = holderWith([
      { permission: "iteration.classify", scope: "custody" },
      { permission: "iteration.classify", scope: "any" },
    ]);

    expect(can(holder, "iteration.classify", { kind: "iteration", categoryPathIds: ["c9"] })).toBe(
      true,
    ); // grants union
  });

  it("lets a managed scope reach only the projects the holder manages", () => {
    const holder = holderWith([{ permission: "project.edit", scope: "managed" }]);
    const project = {
      kind: "project",
      managerId: "U2",
      memberIds: ["U1"],
      memberGroupIds: [],
    } as const;

    expect(can(holder, "project.edit", project)).toBe(false); // a member does not manage
    expect(can(holder, "project.edit", { ...project, managerId: "U1" })).toBe(true);
  });

  it("lets a project scope reach a project through one of the holder's groups", () => {
    const holder = holderWith([{ permission: "project.read", scope: "project" }]);
    const project = {
      kind: "project",
      managerId: "U2",
      memberIds: [],
      memberGroupIds: [],
    } as const;

    expect(can(holder, "project.read", project)).toBe(false);
    expect(can(holder, "project.read", { ...project, memberGroupIds: ["G1"] })).toBe(true);
  });

  it("lets a self-scoped grant reach the holder's own runs only", () => {
    const holder = holderWith([{ permission: "task.cancel", scope: null }]);

    expect(can(holder, "task.cancel", { kind: "run", startedById: "U1" })).toBe(true);
    expect(can(holder, "task.cancel", { kind: "run", startedById: "U2" })).toBe(false);
  });
});
