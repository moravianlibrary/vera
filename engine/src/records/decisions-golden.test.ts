import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { call, testEngine } from "../../test/engine";

interface GoldenCall {
  as: string;
  method: string;
  path: string;
  status: number;
  body: unknown;
  requestBody?: unknown;
}
interface GoldenScenario {
  name: string;
  calls: GoldenCall[];
}
const golden = JSON.parse(
  readFileSync(join(import.meta.dir, "../../test/base-decisions.json"), "utf8"),
) as { scenarios: GoldenScenario[] };

function mask(value: unknown, ids: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => mask(item, ids));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mask(item, ids)]));
  if (typeof value !== "string") return value;
  if (
    /^(?:B-[\w-]+|D\d+|R\d+|IT-[\da-f-]+|E(?:\d+|-[\da-f-]+)|C-[\da-f-]{36}|[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/i.test(
      value,
    )
  ) {
    let token = ids.get(value);
    if (token === undefined) {
      const prefix = value.startsWith("B-")
        ? "B"
        : value.startsWith("IT")
          ? "IT"
          : value.startsWith("E")
            ? "E"
            : value.startsWith("C-")
              ? "C"
              : value.startsWith("D")
                ? "D"
                : value.startsWith("R")
                  ? "R"
                  : "U";
      token = `<${prefix}${[...ids.values()].filter((entry) => entry.startsWith(`<${prefix}`)).length + 1}>`;
      ids.set(value, token);
    }
    return token;
  }
  return /^\d{4}-\d\d-\d\dT/.test(value) ? "<time>" : value;
}

describe("decision golden answers", () => {
  for (const scenario of golden.scenarios) {
    it(scenario.name, async () => {
      const engine = testEngine("base");
      const ids = new Map<string, string>();
      for (const expected of scenario.calls) {
        const answer = await call(engine, expected.method, expected.path, {
          as: expected.as,
          ...(expected.requestBody === undefined ? {} : { body: expected.requestBody }),
        });
        expect(answer.status, `${expected.method} ${expected.path}`).toBe(expected.status);
        expect(mask(await answer.json(), ids), `${expected.method} ${expected.path}`).toEqual(
          expected.body,
        );
      }
      engine.close();
    });
  }
});
