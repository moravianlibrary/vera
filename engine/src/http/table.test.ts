// The engine serves the contract's endpoint table (E1): every entry, once, and nothing else.

import { describe, expect, it } from "bun:test";
import { endpoints as table } from "@vera/contract/endpoints";
import { endpoints as served } from "../engine";

const keyOf = (entry: { method: string; path: string }) => `${entry.method} ${entry.path}`;

describe("the endpoint table", () => {
  it("is what the engine serves", () => {
    const servedKeys = served.map(keyOf);
    expect(new Set(servedKeys).size).toBe(servedKeys.length);
    expect(servedKeys.toSorted()).toEqual(
      Object.values(table)
        .map(keyOf)
        .filter((key) => servedKeys.includes(key))
        .toSorted(),
    );
  });

  it("gives the engine its schemas", () => {
    for (const endpoint of served) {
      const entry = Object.values(table).find((candidate) => keyOf(candidate) === keyOf(endpoint));
      if (entry === undefined) throw new Error(`Missing endpoint ${keyOf(endpoint)}`);
      expect(endpoint.response, keyOf(entry)).toBe(entry.response);
    }
  });
});
