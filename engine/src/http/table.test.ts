// The engine serves the contract's endpoint table (E1): every entry, once, and nothing else.

import { describe, expect, it } from "bun:test";
import { endpoints as table } from "@vera/contract/endpoints";
import { endpoints as served } from "../engine";

const keyOf = (entry: { method: string; path: string }) => `${entry.method} ${entry.path}`;

describe("the endpoint table", () => {
  it("is what the engine serves", () => {
    const servedKeys = served.map(keyOf);
    expect(new Set(servedKeys).size).toBe(servedKeys.length);
    expect(servedKeys.toSorted()).toEqual(Object.values(table).map(keyOf).toSorted());
  });

  it("gives the engine its schemas", () => {
    for (const entry of Object.values(table)) {
      const endpoint = served.find((candidate) => keyOf(candidate) === keyOf(entry));
      expect(endpoint?.response, keyOf(entry)).toBe(entry.response);
    }
  });
});
