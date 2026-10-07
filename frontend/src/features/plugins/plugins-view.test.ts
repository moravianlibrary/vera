// What Plugins' URL holds and what its table shows: Type and State read back from the URL as
// written, an instance found by its configuration, an implementation kept by its own name only
// while no State is picked, and the counts each Type and State would find.

import { describe, expect, it } from "vitest";
import {
  pluginFacetsOf,
  pluginInstanceHrefOf,
  pluginsView,
  selectionOf,
  shownPluginsOf,
} from "@/features/plugins/plugins-view";
import { pluginIndex } from "@/mocks/plugins";

const index = pluginIndex();

describe("pluginsView", () => {
  it("reads back what it writes, and drops what it does not know", () => {
    const query = {
      search: "aleph",
      kinds: ["Registry", "CatalogAdapter"] as const,
      states: ["disabled"] as const,
    };
    const params = pluginsView.toSearchParams(query);

    expect(params.toString()).toBe("q=aleph&kind=CatalogAdapter%2CRegistry&state=disabled");
    expect(pluginsView.parseSearchParams(new URLSearchParams("kind=Nope&state=off"))).toEqual({
      search: undefined,
      kinds: undefined,
      states: undefined,
    });
  });
});

describe("selectionOf", () => {
  it("opens an instance by ?i=, as every other view links it", () => {
    const params = new URLSearchParams(pluginInstanceHrefOf("pi4").split("?")[1]);

    expect(selectionOf(params, index)).toMatchObject({
      kind: "instance",
      instance: { name: "MZK Kramerius" },
      implementation: { name: "KrameriusRegistry" },
    });
    expect(selectionOf(new URLSearchParams("impl=pt6"), index)).toMatchObject({
      kind: "implementation",
    });
    expect(selectionOf(new URLSearchParams("i=nope"), index)).toBeNull();
  });
});

describe("shownPluginsOf", () => {
  it("finds an instance by its configuration, with its implementation", () => {
    const shown = shownPluginsOf(index, { search: "z39.50" });

    expect(shown.instances.map((instance) => instance.name)).toEqual(["NKP Aleph"]);
    expect(shown.implementations.map((implementation) => implementation.name)).toEqual([
      "AlephCatalogAdapter",
    ]);
  });

  it("keeps an implementation by its name only while no State is picked", () => {
    expect(shownPluginsOf(index, { search: "PageCount" }).implementations).toHaveLength(1);
    expect(
      shownPluginsOf(index, { search: "PageCount", states: ["disabled"] }).implementations,
    ).toHaveLength(0);
  });

  it("counts what each Type would find", () => {
    const facets = pluginFacetsOf(index, {});

    expect(facets.kinds?.find((facet) => facet.value === "CatalogAdapter")?.count).toBe(3);
    expect(facets.states?.find((facet) => facet.value === "enabled")?.count).toBe(
      index.instances.length,
    );
  });
});
