// The base seed, converted once from the mock's fixtures: it loads, and every dev server's
// fixture person gets the session the mock gave them (base-sessions.json, written by the same
// conversion).

import { describe, expect, it } from "bun:test";
import { iterationSchema } from "@vera/domain/entities";
import { z } from "zod";
import expected from "../test/base-sessions.json";
import { call, testEngine } from "../test/engine";
import { readSeed } from "./seed";

const engine = testEngine("base");

describe("the base seed", () => {
  it("parses, at the demo's moment", () => {
    expect(readSeed("base").now).toBe("2026-06-25T08:40:00.000Z");
    expect(engine.clock.now().toISOString()).toBe("2026-06-25T08:40:00.000Z");
  });

  it("binds defects and verdict keys to Validation instances and iteration history", () => {
    const seed = readSeed("base");
    const validationIds = new Set(
      seed.collections.pluginInstances
        ?.filter((instance) =>
          seed.collections.pluginImplementations?.some(
            (implementation) =>
              implementation.id === instance.implementationId &&
              implementation.kind === "Validation",
          ),
        )
        .map((instance) => instance.id),
    );
    const iterations = z.array(iterationSchema).parse(seed.collections.iterations);
    for (const iteration of iterations) {
      const keys = new Set(iteration.defects.map((defect) => defect.key));
      for (const defect of iteration.defects)
        expect(validationIds.has(defect.instanceId)).toBe(true);
      for (const verdict of iteration.verdicts)
        for (const key of verdict.defectKeys) expect(keys.has(key)).toBe(true);
    }
  });

  for (const [userId, session] of Object.entries(expected)) {
    it(`signs ${userId} in as the mock did`, async () => {
      const response = await call(engine, "GET", "/api/session", { as: userId });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(session);
    });
  }
});
