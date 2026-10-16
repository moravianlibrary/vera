// The base seed, converted once from the mock's fixtures: it loads, and every dev server's
// fixture person gets the session the mock gave them (base-sessions.json, written by the same
// conversion).

import { describe, expect, it } from "bun:test";
import expected from "../test/base-sessions.json";
import { call, testEngine } from "../test/engine";
import { readSeed } from "./seed";

const engine = testEngine("base");

describe("the base seed", () => {
  it("parses, at the demo's moment", () => {
    expect(readSeed("base").now).toBe("2026-06-25T08:40:00.000Z");
    expect(engine.clock.now().toISOString()).toBe("2026-06-25T08:40:00.000Z");
  });

  for (const [profile, session] of Object.entries(expected)) {
    it(`signs ${profile} in as the mock did`, async () => {
      const response = await call(engine, "GET", "/api/session", { as: profile });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(session);
    });
  }
});
