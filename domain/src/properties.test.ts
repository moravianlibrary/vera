// The value in use, the value on a past day, and what a condition matches (DOC-property-values,
// DOC-property-filter, PLAN-scope).

import { describe, expect, it } from "bun:test";
import type { PropertyDefinition, PropertyValues } from "./properties";
import {
  editPermissionOf,
  formatPropertyValue,
  isValueOf,
  meetsCondition,
  propertyKeyOfPermission,
  textSummaryOf,
  valueInUseAt,
  valueInUseOf,
  withTextCondition,
} from "./properties";

const machines: PropertyDefinition = {
  key: "machines",
  names: { en: "Machines", cs: "Skenery" },
  visibility: "staff",
  type: {
    kind: "enum",
    values: [
      { value: "zeutschel", names: { en: "Zeutschel", cs: "Zeutschel" } },
      { value: "bookeye", names: { en: "Bookeye", cs: "Bookeye" } },
    ],
  },
  isList: true,
  about: "attempt",
  handTier: 100,
  isPredefined: false,
  isCatalogFact: false,
};

const values: PropertyValues = {
  key: "pages",
  sources: [
    {
      source: { kind: "plugin", instanceId: "pi1", instanceName: "MZK Aleph" },
      tier: 50,
      value: 300,
      observedAt: "2026-01-01T09:00:00Z",
      setBy: null,
    },
    {
      source: { kind: "hand" },
      tier: 100,
      value: 320,
      observedAt: "2026-06-01T09:00:00Z",
      setBy: "u2",
    },
  ],
};

describe("property values", () => {
  it("uses the highest tier with a value (DOC-property-values)", () => {
    expect(valueInUseOf(values)?.value).toBe(320);
  });

  it("reads what was in use on a past day (PLAN-scope)", () => {
    expect(valueInUseAt(values, "2026-03-01T00:00:00Z")?.value).toBe(300);
    expect(valueInUseAt(values, "2025-01-01T00:00:00Z")).toBeNull();
  });

  it("checks a value against its definition and names it", () => {
    expect(isValueOf(machines, ["zeutschel"])).toBe(true);
    expect(isValueOf(machines, "zeutschel")).toBe(false);
    expect(isValueOf(machines, ["kodak"])).toBe(false);
    expect(formatPropertyValue(machines, ["bookeye", "zeutschel"])).toBe("Bookeye, Zeutschel");
  });
});

describe("property conditions (DOC-property-filter)", () => {
  const today = new Date("2026-06-25T12:00:00Z");

  it("matches a list when any of its values does", () => {
    expect(
      meetsCondition({ key: "machines", anyOf: ["zeutschel"] }, ["bookeye", "zeutschel"], today),
    ).toBe(true);
    expect(meetsCondition({ key: "machines", anyOf: ["zeutschel"] }, ["bookeye"], today)).toBe(
      false,
    );
  });

  it("matches text that contains, starts or ends with the words, a range, and no value", () => {
    expect(meetsCondition({ key: "title", contains: "NOVINY" }, "Lidové noviny", today)).toBe(true);
    expect(meetsCondition({ key: "title", startsWith: "lidové " }, "Lidové noviny", today)).toBe(
      true,
    );
    expect(meetsCondition({ key: "title", startsWith: "noviny" }, "Lidové noviny", today)).toBe(
      false,
    );
    expect(meetsCondition({ key: "title", endsWith: "Noviny" }, "Lidové noviny", today)).toBe(true);
    expect(
      withTextCondition({ key: "title", contains: "x", hasNoValue: true }, "endsWith", "a b "),
    ).toEqual({ key: "title", hasNoValue: true, endsWith: "a b " });
    expect(textSummaryOf({ key: "title", startsWith: "Lidové" })).toBe("starts with “Lidové”");
    expect(meetsCondition({ key: "pages", numberRange: { from: 100 } }, 320, today)).toBe(true);
    expect(meetsCondition({ key: "pages", numberRange: { to: 99 } }, 320, today)).toBe(false);
    expect(meetsCondition({ key: "size", hasNoValue: true }, null, today)).toBe(true);
    expect(meetsCondition({ key: "size", anyOf: ["A4"] }, null, today)).toBe(false);
    expect(meetsCondition({ key: "size", hasNoValue: true, anyOf: ["A4"] }, "A4", today)).toBe(
      true,
    );
  });
});

describe("property permissions (PERM-property-edit)", () => {
  it("names each property's own permission", () => {
    expect(editPermissionOf("size")).toBe("property.size.edit");
    expect(propertyKeyOfPermission("property.page_count.edit")).toBe("page_count");
    expect(propertyKeyOfPermission("property.define")).toBeNull();
  });
});
