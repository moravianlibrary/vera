// The server's rules for properties: who defines them, keys never used twice, the predefined four
// kept, hand entry refused once an attempt is scanned, and deleting one removes what names it.

import { describe, expect, it } from "vitest";
import { editPermissionOf } from "@/domain/properties";
import { database } from "@/mocks/database";
import { recheckIteration } from "@/mocks/iterations";
import {
  createProperty,
  deleteProperty,
  enterPropertyValue,
  propertyIndex,
} from "@/mocks/properties";
import { resolveSession } from "@/mocks/session";

const admin = () => resolveSession("admin");

const draft = {
  names: { en: "Binding", cs: "Vazba" },
  visibility: "staff" as const,
  type: { kind: "text" as const },
  isList: false,
  about: "document" as const,
  handTier: 100,
};

describe("properties on the mock server", () => {
  it("lets only a holder of property.define define one (DOC-property)", () => {
    expect(createProperty(resolveSession("curator"), "binding", draft)).toMatchObject({
      refusal: { status: 403 },
    });
    expect(createProperty(admin(), "binding", draft)).toMatchObject({
      value: { key: "binding", isPredefined: false, isCatalogFact: false },
    });
  });

  it("never takes hand entry for a fact the catalog holds, the page count apart (DOC-property-hand)", () => {
    const index = propertyIndex(admin());
    const facts = index.definitions.filter((definition) => definition.isCatalogFact);
    expect(facts.map((definition) => definition.key).toSorted()).toEqual([
      "material_type",
      "page_count",
      "shelf_mark",
      "title",
    ]);
  });

  it("keeps the predefined four and never defines a deleted key again (DOC-property-delete)", () => {
    expect(deleteProperty(admin(), "title")).toMatchObject({
      refusal: { status: 409, code: "property.predefined" },
    });
    createProperty(admin(), "shelf_note", draft);
    expect(deleteProperty(admin(), "shelf_note")).toEqual({ value: null });
    expect(createProperty(admin(), "shelf_note", draft)).toMatchObject({
      refusal: { status: 409, code: "property.key_taken" },
    });
  });

  it("removes a deleted property's values and grants (DOC-property-delete)", () => {
    createProperty(admin(), "colour", { ...draft, about: "document" });
    database.roles = database.roles.map((role) =>
      role.id === "admin"
        ? {
            ...role,
            grants: [...role.grants, { permission: editPermissionOf("colour"), scope: "any" }],
          }
        : role,
    );
    expect(enterPropertyValue(admin(), "D4", "colour", { value: "red" })).toMatchObject({
      value: { isRechecked: false },
    });
    deleteProperty(admin(), "colour");
    expect(
      database.documents.find((document) => document.id === "D4")?.properties.map(({ key }) => key),
    ).not.toContain("colour");
    expect(
      database.roles.flatMap((role) => role.grants).map((grant) => grant.permission),
    ).not.toContain(editPermissionOf("colour"));
  });

  it("refuses an attempt's value once it is scanned (DOC-property-hand)", () => {
    // D12's current attempt is digitized.
    expect(enterPropertyValue(admin(), "D12", "machines", { value: ["zeutschel"] })).toMatchObject({
      refusal: { status: 409, code: "iteration.scanned" },
    });
    expect(enterPropertyValue(admin(), "D5", "machines", { value: ["treventus"] })).toMatchObject({
      value: { isRechecked: false },
    });
  });

  it("asks for property.<key>.edit and a value the property takes (PERM-property-edit)", () => {
    expect(
      enterPropertyValue(resolveSession("curator"), "D4", "size", { value: "A4" }),
    ).toMatchObject({ refusal: { status: 403 } });
    expect(enterPropertyValue(admin(), "D4", "size", { value: "B7" })).toMatchObject({
      refusal: { status: 422 },
    });
  });
});

describe("entering a property on several documents", () => {
  it("enters it document by document and says which refused (DOC-property-hand)", async () => {
    const { enterPropertyValues } = await import("@/mocks/properties");
    expect(
      enterPropertyValues(resolveSession("admin"), ["D5", "D12"], "machines", {
        value: ["bookeye"],
      }),
    ).toMatchObject({
      value: { enteredCount: 1, refusals: [{ documentId: "D12" }] },
    });
  });
});

describe("the predefined four's sources (DOC-property-predefined)", () => {
  it("holds what the catalog adapter read as sourced values", () => {
    const document = database.documents.find((candidate) => candidate.id === "D1");
    const titles = document?.properties.find((values) => values.key === "title");
    expect(titles?.sources).toEqual([
      expect.objectContaining({
        source: { kind: "plugin", instanceId: "pi1", instanceName: "MZK Aleph" },
        tier: 50,
        value: document?.title,
      }),
    ]);
    expect(document?.properties.map((values) => values.key)).toEqual(
      expect.arrayContaining(["material_type", "shelf_mark", "size"]),
    );
  });

  it("records a recheck's reading with its own time, in place of the earlier one", () => {
    const iteration = database.iterations.find((candidate) => candidate.id === "IT19");
    const before = new Date().toISOString();
    expect(recheckIteration(admin(), "IT19", {})).toHaveProperty("value");
    const document = database.documents.find((candidate) => candidate.id === iteration?.documentId);
    for (const key of ["title", "material_type", "shelf_mark"]) {
      const sources = document?.properties.find((values) => values.key === key)?.sources ?? [];
      expect(sources).toHaveLength(1);
      expect(sources[0]?.observedAt >= before).toBe(true);
    }
  });
});
