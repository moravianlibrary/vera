// Every language has the same messages, and every permission in the catalog has its line.

import { describe, expect, it } from "vitest";
import { permissionKeys } from "@/domain/permissions";
import { permissionLineOf, permissionLines } from "@/features/access/access-words";
import { resources } from "@/i18n";

describe("messages", () => {
  it("has the same keys in Czech as in English", () => {
    expect(Object.keys(resources.cs.access).sort()).toEqual(
      Object.keys(resources.en.access).sort(),
    );
  });

  it("gives every permission a line", () => {
    for (const permission of permissionKeys) {
      expect(Object.keys(resources.en.access)).toContain(`permission.${permission}.line`);
    }
    expect(permissionLines["request.create"]).toBe("raise a proposal");
    expect(permissionLineOf("property.size.edit", "Size")).toBe("enter Size by hand");
    expect(permissionLineOf("property.size.edit")).toBe("enter its value by hand");
  });
});
