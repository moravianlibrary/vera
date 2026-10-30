import { beforeEach, describe, expect, test } from "vitest";
import { database } from "@/mocks/database";
import { applyVolumeSeed } from "@/mocks/volume-seed";

describe("volume seed", () => {
  let documentCount: number;

  beforeEach(() => {
    documentCount = database.documents.length;
  });

  test("adds generated rows while keeping base documents", () => {
    applyVolumeSeed({
      collections: {
        documents: [
          {
            id: "V-D-test",
            catalogId: "MZK01-999999999",
            unit: null,
            title: "Test title",
            type: "Monograph",
            shelfMark: null,
            pageSources: [],
            registryRecords: [],
            properties: [],
          },
        ],
      },
      fakes: { catalogRecords: [] },
    });
    expect(database.documents).toHaveLength(documentCount + 1);
    expect(database.documents.some((document) => document.id === "D1")).toBe(true);
    expect(database.documents.some((document) => document.id === "V-D-test")).toBe(true);
  });
});
