import { expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { endpoints } from "@vera/contract/endpoints";
import { endpointOf } from "./endpoints";
import type { Recording } from "./recording";

// The mock fakes provider login, so this is covered by backend tests and user journeys.
const notRecordable = ["loginStart", "loginCallback"] as const;

it("covers every endpoint with a recording call", () => {
  const directory = join(import.meta.dir, "../recordings");
  const recordings = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")) as Recording);
  const calls = recordings.flatMap((recording) =>
    recording.scenarios.flatMap((scenario) => scenario.calls),
  );
  const uncovered = Object.entries(endpoints).filter(([name]) => {
    const recorded = calls.some((call) => endpointOf(call) === name);
    if (notRecordable.includes(name as (typeof notRecordable)[number])) {
      expect(recorded, `${name} is not recordable from the mock`).toBe(false);
      return false;
    }
    return !recorded;
  });

  for (const name of notRecordable) {
    expect(Object.hasOwn(endpoints, name), `${name} is an endpoint name`).toBe(true);
    expect(
      calls.some((call) => endpointOf(call) === name),
      `${name} is not recorded from the mock`,
    ).toBe(false);
  }
  console.log(`notRecordable: ${JSON.stringify(notRecordable)}`);
  console.log(`uncovered: ${JSON.stringify(uncovered.map(([name]) => name))}`);
  expect(uncovered.map(([name]) => name)).toEqual([]);
});
