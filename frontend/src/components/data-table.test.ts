// DataTable's grouping: rows fall into the groups they name, level within level, and a level that
// names its own groups shows one even with no rows, in its own order.

import { describe, expect, it } from "vitest";
import { groupsOf } from "@/components/data-table";

const rows = [
  { id: "pi1", kind: "Catalog", implementation: "Aleph" },
  { id: "pi2", kind: "Catalog", implementation: "Aleph" },
  { id: "pi4", kind: "Registry", implementation: "Kramerius" },
];

describe("groupsOf", () => {
  it("groups rows in the order they come, level within level", () => {
    const groups = groupsOf(rows, [
      { keyOf: (row) => row.kind, header: () => null, isCollapsible: true },
      { keyOf: (row) => row.implementation, header: () => null, isCollapsible: false },
    ]);

    expect(groups.map((group) => [group.key, group.rows.length])).toEqual([
      ["Catalog", 2],
      ["Registry", 1],
    ]);
    expect(groups[0]?.groups?.map((group) => group.key)).toEqual(["Aleph"]);
    expect(groups[0]?.groups?.[0]?.groups).toBeNull();
  });

  it("shows the groups a level names, with no rows too", () => {
    const groups = groupsOf(rows, [
      {
        keyOf: (row) => row.kind,
        keysWithin: () => ["Registry", "Catalog"],
        header: () => null,
        isCollapsible: true,
      },
      {
        keyOf: (row) => row.implementation,
        keysWithin: (kind) => (kind === "Registry" ? ["Kramerius", "RDCZ"] : ["Aleph"]),
        header: () => null,
        isCollapsible: false,
      },
    ]);

    expect(groups.map((group) => group.key)).toEqual(["Registry", "Catalog"]);
    expect(groups[0]?.groups?.map((group) => [group.key, group.rows.length])).toEqual([
      ["Kramerius", 1],
      ["RDCZ", 0],
    ]);
  });
});
