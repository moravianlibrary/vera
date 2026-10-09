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
