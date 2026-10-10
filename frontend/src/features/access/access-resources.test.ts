import { describe, expect, it } from "vitest";
import type { AccessIndex } from "@/api/access";
import {
  categorySourcesOf,
  proposalSourcesOf,
  uniquePeople,
} from "@/features/access/access-resources";

const index = {
  categories: [
    { id: "root", name: "Root", parentId: null },
    { id: "child", name: "Child", parentId: "root" },
  ],
  categoryMemberships: [{ categoryId: "root", userIds: ["u1"] }],
  groups: [{ id: "g1", name: "Team", memberIds: ["u1", "u2"], categoryIds: ["root"] }],
  custodies: [{ id: "set", memberIds: ["u1"], groupIds: ["g1"] }],
} as AccessIndex;

describe("resource access provenance", () => {
  it("keeps direct and group assignments inherited from an ancestor", () => {
    expect(categorySourcesOf(index, "child")).toEqual([
      { userId: "u1", viaGroupId: null, grantedOnId: "root" },
      { userId: "u1", viaGroupId: "g1", grantedOnId: "root" },
      { userId: "u2", viaGroupId: "g1", grantedOnId: "root" },
    ]);
  });

  it("keeps every set membership source while counting people once", () => {
    const sources = proposalSourcesOf(index, {
      id: "proposal",
      title: "Proposal",
      custodyIds: ["set"],
    });
    expect(sources).toEqual([
      { userId: "u1", viaGroupId: null, custodyId: "set" },
      { userId: "u1", viaGroupId: "g1", custodyId: "set" },
      { userId: "u2", viaGroupId: "g1", custodyId: "set" },
    ]);
    expect(uniquePeople(sources)).toEqual(["u1", "u2"]);
  });
});
