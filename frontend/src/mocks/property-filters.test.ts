// Filtering on properties (DOC-property-filter): by type, with *no value*, counted as facets, on
// every page that shows them, and public ones only in public detail (DOC-property-visibility).

import { describe, expect, it } from "vitest";
import { isSameDocumentQuery } from "@/api/documents";
import { conditionsOf, propertyParamsOf, withCondition } from "@/api/properties";
import { queryDocuments } from "@/mocks/documents";
import { allPropertyDefinitions } from "@/mocks/properties";
import { queryRequests } from "@/mocks/requests";
import { resolveSession } from "@/mocks/session";
import { queryValidations } from "@/mocks/validations";

const ids = (page: { items: { document: { id: string } }[] }) =>
  page.items.map((record) => record.document.id).toSorted();

describe("property conditions in a URL", () => {
  it("reads each by its definition's type and drops what it does not take", () => {
    const params = propertyParamsOf(
      new URLSearchParams("p.size=A4,B7&p.size.none=1&p.title=noviny&p.unknown=1&q=x"),
    );
    expect(conditionsOf(params, allPropertyDefinitions())).toEqual([
      { key: "title", contains: "noviny" },
      { key: "size", hasNoValue: true, anyOf: ["A4"] },
    ]);
    expect(withCondition(params, { key: "size" })).toEqual({
      "p.title": "noviny",
      "p.unknown": "1",
    });
  });

  it("writes what a text starts or ends with beside what it contains", () => {
    const condition = { key: "title", startsWith: "Lidové", endsWith: "noviny" };
    const params = withCondition(undefined, condition);
    expect(params).toEqual({ "p.title.starts": "Lidové", "p.title.ends": "noviny" });
    expect(conditionsOf(params, allPropertyDefinitions())).toEqual([condition]);
    expect(withCondition(params, { key: "title" })).toBeUndefined();
  });

  it("names the same filter however its values are ordered", () => {
    expect(
      isSameDocumentQuery(
        { properties: { "p.size": "A4,A5" } },
        { properties: { "p.size": "A5,A4" } },
      ),
    ).toBe(true);
  });
});

describe("filtering Documents on properties", () => {
  const admin = resolveSession("admin");

  it("finds an enum's values, no value, and counts each", () => {
    const page = queryDocuments(admin, { properties: { "p.size": "A4" } });
    expect(ids(page)).toEqual(["D36", "D4", "D47"]);
    const unfiltered = queryDocuments(admin, {});
    expect(unfiltered.propertyFacets.size?.values).toContainEqual({ value: "A2", count: 3 });
    expect(unfiltered.propertyFacets.size?.noValue).toBe(unfiltered.total - 10);
    const none = queryDocuments(admin, { properties: { "p.size.none": "1" } });
    expect(none.total).toBe(unfiltered.total - 10);
  });

  it("matches a list when any of its values does, on the current attempt", () => {
    const page = queryDocuments(admin, { properties: { "p.machines": "zeutschel" } });
    expect(ids(page)).toEqual(["D1", "D36", "D5"]);
  });

  it("filters text on what it contains", () => {
    const page = queryDocuments(admin, { properties: { "p.title": "brněn" } });
    expect(
      page.items.every((record) => record.document.title.toLowerCase().includes("brněn")),
    ).toBe(true);
    expect(page.total).toBeGreaterThan(0);
  });

  it("filters text on what it starts or ends with", () => {
    const starts = queryDocuments(admin, { properties: { "p.title.starts": "lidové" } });
    expect(starts.total).toBeGreaterThan(0);
    expect(
      starts.items.every((record) => record.document.title.toLowerCase().startsWith("lidové")),
    ).toBe(true);
    const ends = queryDocuments(admin, { properties: { "p.title.ends": "noviny" } });
    expect(ends.total).toBeGreaterThan(0);
    expect(
      ends.items.every((record) => record.document.title.toLowerCase().endsWith("noviny")),
    ).toBe(true);
  });

  it("reads only public properties in public detail", () => {
    const reader = resolveSession("reader");
    const page = queryDocuments(reader, { properties: { "p.machines": "zeutschel" } });
    const all = queryDocuments(reader, {});
    expect(page.total).toBe(all.total);
    expect(Object.keys(all.propertyFacets)).not.toContain("machines");
  });
});

describe("filtering the other pages on properties", () => {
  const admin = resolveSession("admin");

  it("filters Documents Validations and Requests too", () => {
    const validations = queryValidations(admin, { properties: { "p.size": "A3" } });
    expect(validations.items.map((row) => row.document.id)).toEqual(["D3"]);
    const requests = queryRequests(admin, { properties: { "p.size.none": "1" } });
    expect(requests.items.every((row) => row.record.document.properties.length === 0)).toBe(true);
    expect(Object.keys(requests.propertyFacets)).not.toContain("material_type");
  });
});

describe("narrowing the list editor's pool on properties", () => {
  it("offers only what is ready with the value", async () => {
    const { queryPool } = await import("@/mocks/lists");
    const pool = queryPool({ properties: { "p.size": "A4" } });
    expect(pool.items.map((item) => item.document.id).toSorted()).toEqual(["D4", "D47"]);
    expect(queryPool({}).propertyFacets.size?.values).toContainEqual({ value: "A4", count: 2 });
  });
});
