import { describe, expect, it } from "vitest";
import { canOpenNavigationEntry, visibleNavigation } from "@/components/layout/navigation";
import { resolveSession } from "@/mocks/session";

describe("Mixes navigation", () => {
  it("opens Mixes from Categories while keeping direct links available", () => {
    const admin = resolveSession("admin");
    expect(visibleNavigation(admin).map((entry) => entry.id)).toContain("categories");
    expect(visibleNavigation(admin).map((entry) => entry.id)).not.toContain("mixes");
    expect(canOpenNavigationEntry(admin, "mixes")).toBe(true);

    const mixOnly = {
      ...admin,
      grants: admin.grants.filter((grant) => grant.permission !== "category.read"),
    };
    expect(visibleNavigation(mixOnly).map((entry) => entry.id)).toContain("mixes");
    expect(visibleNavigation(mixOnly).map((entry) => entry.id)).not.toContain("categories");
  });
});

describe("Documents perspectives", () => {
  it("opens a requester's documents directly and offers both perspectives to a manager", () => {
    const reader = resolveSession("reader");
    const admin = resolveSession("admin");
    expect(visibleNavigation(reader).find((entry) => entry.id === "documents")).toMatchObject({
      path: "/my-documents",
      visibleLabel: "My Documents",
    });
    expect(visibleNavigation(admin).find((entry) => entry.id === "documents")).toMatchObject({
      path: "/documents",
      visibleLabel: "Documents",
    });
    expect(canOpenNavigationEntry(reader, "my-documents")).toBe(true);
    expect(canOpenNavigationEntry(admin, "my-documents")).toBe(true);
    expect(canOpenNavigationEntry(resolveSession("no-access"), "my-documents")).toBe(false);
  });
});
