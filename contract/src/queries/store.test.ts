import { describe, expect, test } from "bun:test";
import type { StoredPropertyDefinition } from "@vera/domain/properties";
import type { RecordStore } from "@vera/domain/store";
import { allPropertyDefinitions } from "./properties";

describe("record store property declarations", () => {
  test("marks declared catalog properties and leaves undeclared properties unset", () => {
    const definitions: StoredPropertyDefinition[] = ["from_catalog", "hand_only"].map((key) => ({
      key,
      names: { en: key, cs: key },
      visibility: "public",
      type: { kind: "text" },
      isList: false,
      about: "document",
      handTier: null,
      isPredefined: false,
    }));
    const store: RecordStore = {
      today: new Date("2026-01-01"),
      catalogPropertyKeys: new Set(["from_catalog"]),
      roles: [],
      users: [],
      groups: [],
      categories: [],
      projects: [],
      batches: [],
      requestCustodies: [],
      documents: [],
      iterations: [],
      requests: [],
      statusLog: [],
      propertyDefinitions: definitions,
    };

    expect(
      allPropertyDefinitions(store).map(({ key, isCatalogFact }) => [key, isCatalogFact]),
    ).toEqual([
      ["from_catalog", true],
      ["hand_only", false],
    ]);
  });
});
