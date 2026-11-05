import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { endpoints } from "./endpoints";

const entries = Object.entries(endpoints);

describe("the endpoint table", () => {
  it("names each method and path once", () => {
    const keys = entries.map(([, entry]) => `${entry.method} ${entry.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("holds paths under the API's base, with a schema for every path segment it names", () => {
    for (const [name, entry] of entries) {
      expect(entry.path, name).toMatch(/^\/[a-z0-9\-/:]*$/i);
      const named = [...entry.path.matchAll(/:([a-zA-Z]+)/g)].map((match) => match[1]).sort();
      const params = entry.params;
      const declared =
        params instanceof z.ZodObject ? Object.keys(params.shape).sort() : ([] as string[]);
      expect(declared, name).toEqual(named);
    }
  });

  it("keeps property filters and rejects undeclared query keys", () => {
    expect(endpoints.documents.query?.parse({ "p.size": "A2" })).toMatchObject({
      "p.size": "A2",
    });
    expect(endpoints.requests.query?.parse({ "p.size.none": "1" })).toMatchObject({
      "p.size.none": "1",
    });
    expect(endpoints.documents.query?.safeParse({ unexpected: "value" }).success).toBe(false);
    expect(endpoints.requests.query?.safeParse({ unexpected: "value" }).success).toBe(false);
  });
});
