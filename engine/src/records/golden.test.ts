import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { call, testEngine } from "../../test/engine";

interface GoldenCall {
  userId: string;
  method: "GET";
  path: string;
  status: number;
  code?: string;
  body?: unknown;
}
const golden = JSON.parse(
  readFileSync(join(import.meta.dir, "../../test/base-records.json"), "utf8"),
) as GoldenCall[];

describe("record query golden answers", () => {
  it("matches the mock for every development person", async () => {
    const engine = testEngine("base");
    for (const expected of golden) {
      const response = await call(engine, expected.method, expected.path, { as: expected.userId });
      expect(response.status, `${expected.userId} ${expected.path}`).toBe(expected.status);
      if (expected.status === 200)
        expect(await response.json(), `${expected.userId} ${expected.path}`).toEqual(expected.body);
      else {
        const problem = (await response.json()) as { code?: string };
        expect(problem.code, `${expected.userId} ${expected.path}`).toBe(expected.code);
      }
    }
    engine.close();
  });
});
