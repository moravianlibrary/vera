// Base seed: compare what Users & Groups shows to one recording from the mock.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accessRecordActionRoute, apiRoutes } from "@vera/contract/routes";
import { call, testEngine } from "../../test/engine";

const golden = JSON.parse(
  readFileSync(join(import.meta.dir, "../../test/base-access.json"), "utf8"),
) as {
  index: Record<string, unknown>;
  roleImpacts: Record<string, unknown>;
  custodyImpacts: Record<string, unknown>;
  accounts: Record<string, unknown>;
};

function withoutLaterSteps(index: Record<string, unknown>) {
  const fields = structuredClone(index);
  for (const field of [
    "proposals",
    "openCount",
    "projects",
    "sharedWatchlists",
    "properties",
    "placedByIds",
  ]) {
    delete fields[field];
  }
  const custodies = (fields.custodies as Record<string, unknown>[]).map((record) => {
    const comparable = { ...record };
    delete comparable.openCount;
    delete comparable.placedByIds;
    return comparable;
  });
  return { ...fields, custodies };
}

function withoutStepThreeCustodyCounts(impact: Record<string, unknown>) {
  // Step 3 places proposals (decision 9 and L8); until then these impact counts are zero.
  const comparable = { ...impact };
  delete comparable.openCount;
  delete comparable.toFallbackCount;
  return comparable;
}

describe("access golden answers", () => {
  it("matches the mock's index, impacts and account records", async () => {
    const engine = testEngine("base");
    const response = await call(engine, "GET", `/api${apiRoutes.access}`, { as: "u3" });
    expect(response.status).toBe(200);
    const index = (await response.json()) as Record<string, unknown>;
    expect(withoutLaterSteps(index)).toEqual(withoutLaterSteps(golden.index));

    for (const [roleId, impact] of Object.entries(golden.roleImpacts)) {
      const result = await call(
        engine,
        "GET",
        `/api${accessRecordActionRoute("roles", roleId, "impact")}`,
        { as: "u3" },
      );
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual(impact);
    }
    for (const [custodyId, impact] of Object.entries(golden.custodyImpacts)) {
      const result = await call(
        engine,
        "GET",
        `/api${accessRecordActionRoute("custodies", custodyId, "impact")}`,
        { as: "u3" },
      );
      expect(result.status).toBe(200);
      expect(
        withoutStepThreeCustodyCounts((await result.json()) as Record<string, unknown>),
      ).toEqual(withoutStepThreeCustodyCounts(impact as Record<string, unknown>));
    }
    for (const [userId, account] of Object.entries(golden.accounts)) {
      const result = await call(engine, "GET", `/api${apiRoutes.sessionAccount}`, { as: userId });
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual(account);
    }
    engine.close();
  });
});
