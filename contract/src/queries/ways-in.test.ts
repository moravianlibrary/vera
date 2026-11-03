import { describe, expect, it } from "bun:test";
import type { CatalogRecord } from "@vera/domain/catalog";
import type { StoredPluginImplementation, StoredPluginInstance } from "@vera/domain/plugin-store";
import { barcodeAt, identifierRules, readRecordLink, waysInOf } from "./ways-in";

function instance(
  id: string,
  implementationId: string,
  configuration: Record<string, string> = {},
  order = 1,
): StoredPluginInstance {
  return {
    id,
    name: id,
    implementationId,
    version: "1",
    isEnabled: true,
    configuration,
    linkedCategoryId: null,
    triggers: [],
    settings: { kind: "Identifier", order },
    createdBy: "u1",
    createdAt: "2026-01-01",
    lastRunAt: null,
    isDeleted: false,
  };
}
function implementation(
  id: string,
  name: string,
  kind: StoredPluginImplementation["kind"],
  operations: (
    | "readBarcode"
    | "readPhoto"
    | "entry"
    | "readLink"
    | "search"
    | "changes"
    | "sync"
  )[] = [],
): StoredPluginImplementation {
  return {
    id,
    descriptorId: id,
    name,
    kind,
    description: "",
    versions: [
      {
        version: "1",
        contractVersion: "1",
        installedAt: "2026-01-01",
        installedBy: "u1",
        triggers: [],
        configFields: [],
        declares: {
          properties: [],
          operations,
          identifierTypes: [],
          rawStates: [],
          rules: [],
          agent: null,
          generatorClass: null,
          channelInterface: null,
          loginEntry: null,
        },
      },
    ],
  };
}
const catalogs = { "aleph.nkp.cz": { base: "NKC", opacUrl: "https://aleph.nkp.cz" } };

describe("ways in queries", () => {
  it("offers search only when declared and not switched off", () => {
    const implementations = [implementation("cat", "Aleph", "CatalogAdapter", ["search"])];
    const instances = [
      instance("on", "cat", { base_url: "aleph.nkp.cz" }),
      instance("off", "cat", { base_url: "aleph.nkp.cz", search: "off" }),
    ];
    const result = waysInOf(instances, implementations, catalogs);
    expect(result.searchCatalogs.map(({ id }) => id)).toEqual(["on"]);
  });

  it("does not offer an undeclared catalog search", () => {
    const implementations = [implementation("cat", "Aleph", "CatalogAdapter")];
    const instances = [instance("on", "cat", { base_url: "aleph.nkp.cz" })];

    expect(waysInOf(instances, implementations, catalogs).searchCatalogs).toEqual([]);
  });

  it("a declared mirror offers search unless the instance switches it off", () => {
    const implementations = [implementation("cat", "Aleph", "CatalogAdapter", ["sync"])];
    const instances = [
      instance("mirror", "cat", { base_url: "aleph.nkp.cz" }),
      instance("off", "cat", { base_url: "aleph.nkp.cz", search: "off" }),
    ];

    expect(
      waysInOf(instances, implementations, catalogs).searchCatalogs.map(({ id }) => id),
    ).toEqual(["mirror"]);
  });

  it("puts enabled identifier types in instance order before remaining types", () => {
    const implementations = [implementation("pattern", "Pattern", "Identifier")];
    const instances = [
      instance("isbn", "pattern", { type: "isbn" }, 2),
      instance("nbn", "pattern", { type: "nbn" }, 1),
    ];
    expect(
      identifierRules(instances, implementations)
        .slice(0, 2)
        .map(({ type }) => type),
    ).toEqual(["nbn", "isbn"]);
  });

  it("reads NKC record links and refuses unreadable links", () => {
    const implementations = [implementation("cat", "NKC", "CatalogAdapter")];
    const instances = [instance("nkc", "cat", { base_url: "aleph.nkp.cz" })];
    expect(
      readRecordLink(
        { catalogInstanceId: "nkc", link: "https://aleph.nkp.cz/?doc_number=002345678&base=NKC01" },
        instances,
        implementations,
        catalogs,
      ),
    ).toEqual({ value: { catalogId: "NKC01-002345678" } });
    expect(
      readRecordLink(
        { catalogInstanceId: "nkc", link: "https://aleph.nkp.cz/Record/NKC01-002345678" },
        instances,
        implementations,
        catalogs,
      ),
    ).toEqual({ value: { catalogId: "NKC01-002345678" } });
    expect(
      readRecordLink(
        { catalogInstanceId: "nkc", link: "unreadable" },
        instances,
        implementations,
        catalogs,
      ),
    ).toEqual({
      refusal: {
        status: 422,
        code: "proposal.link_unread",
        message: "nkc reads no record in that",
      },
    });
  });

  it("cycles through barcodes and returns null for an empty photo", () => {
    const implementations = [implementation("camera", "Camera", "Input", ["readBarcode"])];
    const instances = [instance("camera", "camera")];
    const record = {
      catalogId: "NKC01-1",
      title: "Book",
      type: "Monograph",
      units: null,
      identifiers: [],
      shelfMarks: {},
      barcodes: { first: null, second: null },
    } satisfies CatalogRecord;
    expect(barcodeAt([record], 0, 2, instances, implementations)).toEqual({
      value: { code: "first" },
    });
    expect(barcodeAt([record], 1, 2, instances, implementations)).toEqual({
      value: { code: "second" },
    });
    expect(barcodeAt([record], 2, 0, instances, implementations)).toEqual({
      value: { code: null },
    });
  });

  it("offers camera and photo ways in from their declared operations", () => {
    const implementations = [
      implementation("camera", "Camera", "Input", ["readBarcode"]),
      implementation("photo", "Photo", "Input", ["readPhoto"]),
    ];
    const instances = [instance("camera", "camera"), instance("photo", "photo")];

    expect(waysInOf(instances, implementations, catalogs)).toMatchObject({
      canScanWithCamera: true,
      canReadPhotos: true,
    });
  });

  it("offers a portal source from the declared entry operation", () => {
    const implementations = [implementation("portal", "Portal", "Input", ["entry"])];
    const instances = [instance("portal", "portal", { allowed_origins: "https://example.org" })];

    expect(waysInOf(instances, implementations, catalogs).entrySources).toEqual([
      { id: "portal", name: "portal", allowedOrigins: ["https://example.org"] },
    ]);
  });
});
