import { describe, expect, it } from "bun:test";
import { testEngine } from "../../test/engine";
import { readSeed } from "../seed";
import { engineRequestPlugins } from "./plugins";
import { engineStore, pragueMidnightOf } from "./store";

describe("seeded records", () => {
  it("uses Prague midnight with the season's UTC offset", () => {
    expect(pragueMidnightOf(new Date("2026-01-10T12:00:00Z")).toISOString()).toBe(
      "2026-01-09T23:00:00.000Z",
    );
    expect(pragueMidnightOf(new Date("2026-07-10T12:00:00Z")).toISOString()).toBe(
      "2026-07-09T22:00:00.000Z",
    );
  });

  it("loads query records and fake custody answers", () => {
    const engine = testEngine("base"),
      seed = readSeed("base");
    const store = engineStore(engine);
    expect(store.documents.length).toBe(seed.collections.documents?.length ?? 0);
    expect(store.iterations.length).toBe(seed.collections.iterations?.length ?? 0);
    expect(store.requests.length).toBe(seed.collections.requests?.length ?? 0);
    expect(store.batches.length).toBe(seed.collections.batches?.length ?? 0);
    const plugin = engineRequestPlugins(engine);
    const ask = store.requests.find((r) => r.id.startsWith("R16"));
    expect(ask).toBeDefined();
    if (ask === undefined) throw new Error("Expected the base seed to include R16");
    const doc = store.documents.find((d) => d.id === ask.documentId);
    expect(doc).toBeDefined();
    if (doc === undefined) throw new Error("Expected R16's document to be loaded");
    expect(plugin.placementsOf(ask, doc)).toEqual(["pc1", "pc2"]);
    const ruled = store.requests.find(
      (r) =>
        ![
          "R16",
          "R17",
          "R18",
          "R19",
          "R20",
          "R28",
          "R29",
          "R30",
          "R31",
          "R32",
          "R33",
          "R34",
          "R35",
          "R36",
          "R37",
        ].includes(r.id),
    );
    expect(ruled).toBeDefined();
    if (ruled === undefined) throw new Error("Expected a request without a stored placement");
    const ruledDoc = store.documents.find((d) => d.id === ruled.documentId);
    expect(ruledDoc).toBeDefined();
    if (ruledDoc === undefined) throw new Error("Expected the ruled request's document to load");
    expect(plugin.placementsOf(ruled, ruledDoc)).toEqual(
      ruledDoc.type === "Periodical" ? ["pc1"] : [],
    );
    engine.close();
  });
});
