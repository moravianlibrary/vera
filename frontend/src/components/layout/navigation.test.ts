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

describe("Documents and My Documents (VIEW-own-label)", () => {
  it("gives each detail its own entry, both to someone holding both", () => {
    const reader = resolveSession("reader");
    const admin = resolveSession("admin");
    const documentEntriesOf = (profile: ReturnType<typeof resolveSession>) =>
      visibleNavigation(profile)
        .filter((entry) => entry.id === "documents" || entry.id === "my-documents")
        .map((entry) => entry.path);
    expect(documentEntriesOf(reader)).toEqual(["/my-documents"]);
    expect(documentEntriesOf(admin)).toEqual(["/my-documents", "/documents"]);
    expect(canOpenNavigationEntry(reader, "my-documents")).toBe(true);
    expect(canOpenNavigationEntry(admin, "my-documents")).toBe(true);
    expect(canOpenNavigationEntry(resolveSession("no-access"), "my-documents")).toBe(false);
  });
});

describe("System watchlists navigation (VIEW-watchlists)", () => {
  it("limits the management page to permission holders", () => {
    expect(canOpenNavigationEntry(resolveSession("admin"), "watchlists")).toBe(true);
    expect(canOpenNavigationEntry(resolveSession("reader"), "watchlists")).toBe(false);
  });
});
