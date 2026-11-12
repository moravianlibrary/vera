import { afterEach, describe, expect, it } from "vitest";
import { database } from "@/mocks/database";
import { relinkDocument } from "@/mocks/iterations";
import { resolveSession } from "@/mocks/session";

const originalD35 = structuredClone(database.documents.find((document) => document.id === "D35"));
const originalLog = [...database.statusLog];
const originalHooks = [...database.hooks];
const originalDeliveries = [...database.hookDeliveries];

afterEach(() => {
  if (originalD35 !== undefined) {
    const index = database.documents.findIndex((document) => document.id === "D35");
    database.documents.splice(index, 1, originalD35);
  }
  database.statusLog.splice(0, database.statusLog.length, ...originalLog);
  database.hooks.splice(0, database.hooks.length, ...originalHooks);
  database.hookDeliveries.splice(0, database.hookDeliveries.length, ...originalDeliveries);
});

describe("document relinking", () => {
  it("updates the catalog id, clears the state, records the event and delivers the hook", () => {
    const hook = database.hooks[0];
    if (hook === undefined) throw new Error("Expected a hook fixture");
    database.hooks.push({
      ...hook,
      id: "H-relink-test",
      events: ["document.relinked"],
      filter: "",
      batch: null,
    });

    const result = relinkDocument(resolveSession("admin"), "D35", {
      catalogId: "MZK01-001502234",
    });

    expect(result).toHaveProperty("value");
    expect(database.documents.find((document) => document.id === "D35")).toMatchObject({
      catalogId: "MZK01-001502234",
      catalogState: null,
    });
    expect(
      database.statusLog.findLast((entry) => entry.code === "document.relinked"),
    ).toMatchObject({
      subjectKind: "document",
      subjectId: "D35",
      code: "document.relinked",
      data: { catalogId: { from: "MZK01-001502233", to: "MZK01-001502234" } },
    });
    expect(database.hookDeliveries.at(-1)?.events).toEqual(["document.relinked"]);
  });

  it.each([
    ["unknown catalog id", "not-in-catalog", 422, "document.catalog_unread"],
    ["its own catalog id", "MZK01-001502233", 422, "document.same_catalog_record"],
  ] as const)("refuses %s", (_name, catalogId, status, code) => {
    expect(relinkDocument(resolveSession("admin"), "D35", { catalogId })).toMatchObject({
      refusal: { status, code },
    });
  });

  it("refuses a catalog id and unit already held by another document", () => {
    expect(
      relinkDocument(resolveSession("admin"), "D35", { catalogId: "MZK01-001300094" }),
    ).toMatchObject({
      refusal: { status: 409, code: "document.catalog_record_held" },
    });
  });
});
