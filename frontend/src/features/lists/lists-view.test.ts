// The hand-off from an intention's card to a new list: what the URL carries survives the trip.

import { describe, expect, it } from "vitest";
import { generationHrefOf, generationStartOf } from "@/features/lists/lists-view";

const paramsOf = (href: string) => new URLSearchParams(href.split("?")[1]);

describe("generationHrefOf and generationStartOf", () => {
  it("carry the intention, the pages and a correcting run's allocation", () => {
    const start = { intentionId: "i8", pages: 3000, allocation: { c21: 1650, c22: 1350 } };
    const href = generationHrefOf(start);

    expect(href).toBe("/lists/new?generate&shape=i8&pages=3000&alloc=c21:1650,c22:1350");
    expect(generationStartOf(paramsOf(href))).toEqual(start);
  });

  it("is nothing without generate, and drops what does not read", () => {
    expect(generationStartOf(new URLSearchParams("shape=i8"))).toBeNull();
    expect(generationStartOf(new URLSearchParams("generate&pages=x&alloc=c1:y"))).toEqual({
      intentionId: null,
      pages: null,
      allocation: null,
    });
  });
});
