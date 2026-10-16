// Each property's permission accepts `any` only and needs `iteration.read@any`
// (PERM-property-edit), under its own heading.

import { describe, expect, it } from "vitest";
import {
  catalogEntryOf,
  isAcceptedGrant,
  missingRequirementsOf,
  permissionSchema,
  withRequirements,
} from "@/domain/permissions";

describe("property permissions", () => {
  it("are parsed, grouped under Properties and accepted at any only", () => {
    expect(permissionSchema.safeParse("property.size.edit").success).toBe(true);
    expect(permissionSchema.safeParse("property.Size.edit").success).toBe(false);
    expect(catalogEntryOf("property.size.edit").group).toBe("Properties");
    expect(isAcceptedGrant({ permission: "property.size.edit", scope: "any" })).toBe(true);
    expect(isAcceptedGrant({ permission: "property.size.edit", scope: "custody" })).toBe(false);
    expect(catalogEntryOf("property.define").group).toBe("Administration");
  });

  it("need iteration.read everywhere", () => {
    const grants = [{ permission: "property.size.edit" as const, scope: "any" as const }];
    expect(missingRequirementsOf(grants)).toEqual([
      { grant: grants[0], needs: { permission: "iteration.read", scope: "any" } },
    ]);
    expect(withRequirements(grants)).toContainEqual({ permission: "iteration.read", scope: "any" });
  });
});
