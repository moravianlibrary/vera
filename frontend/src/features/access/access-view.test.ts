// Users & Groups' state and links: which record the URL selects, what the search and Show leave
// in the columns, and what a selected record lights up and draws, over the mock's index.

import { describe, expect, it } from "vitest";
import { linksOf } from "@/features/access/access-links";
import { filteredIndex, selectionOf, showFacetsOf } from "@/features/access/access-view";
import { accessIndex } from "@/mocks/access";

const index = accessIndex();

describe("selectionOf", () => {
  it("takes the record the URL names, and the first user otherwise", () => {
    expect(selectionOf(new URLSearchParams("r=curator"), index)).toEqual({
      kind: "roles",
      id: "curator",
    });
    expect(selectionOf(new URLSearchParams("g=nowhere"), index)).toEqual({
      kind: "users",
      id: "u1",
    });
  });
});

describe("filteredIndex", () => {
  it("narrows every column by the search, and users by Show", () => {
    const shown = filteredIndex(index, { search: "period", show: undefined });

    expect(shown.groups.map(({ id }) => id)).toEqual(["g1"]);
    expect(shown.custodies.map(({ id }) => id)).toEqual(["pc1"]);
    expect(filteredIndex(index, { show: ["none"] }).users.map(({ id }) => id)).toEqual(["u10"]);
    expect(filteredIndex(index, { show: ["agent"] }).users.map(({ id }) => id)).toEqual([
      "a1",
      "a2",
      "a3",
    ]);
  });

  it("counts what each Show would find", () => {
    expect(showFacetsOf(index, {}).show).toEqual([
      { value: "person", count: 10 },
      { value: "agent", count: 3 },
      { value: "none", count: 1 },
    ]);
  });
});

describe("linksOf", () => {
  it("draws a person's roles from the left, dashed when only mapped, and their groups to the right", () => {
    const { tags, lines } = linksOf(index, { kind: "users", id: "u3" });

    expect(tags.get("roles:admin")).toEqual({ text: "by hand", isDirect: true });
    expect(tags.get("roles:staff")).toEqual({ text: "mapped", isDirect: false });
    expect(lines).toContainEqual({ from: "roles:staff", to: "users:u3", isDashed: true });
    expect(lines).toContainEqual({ from: "users:u3", to: "custodies:pc0", isDashed: false });
  });

  it("names how each member reaches a custody, dashing the way through a group", () => {
    const { tags, lines } = linksOf(index, { kind: "custodies", id: "pc1" });

    expect(tags.get("users:u8")?.text).toBe("member");
    expect(tags.get("users:u1")?.text).toBe("via Periodicals Curators");
    expect(tags.get("groups:g1")?.text).toBe("member of it");
    expect(lines).toContainEqual({ from: "users:u1", to: "groups:g1", isDashed: true });
  });
});
