import { expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { endpoints } from "@vera/contract/endpoints";

const unreachable = {
  "login.expired":
    "frontend/src/mocks/handlers.ts:490 — the mock exposes only a fake provider login and has no callback or expiring token state.",
  "list.ends_before_start":
    "frontend/src/mocks/handlers.ts:1298 — listDraftSchema rejects reversed dates into invalidResponse before createList's list.ends_before_start guard, so API calls cannot reach that refusal.",
  "mix.no_primary":
    "frontend/src/mocks/intentions.ts:464 — primary changes always select another mix, while archive and delete refuse the primary; no API action leaves none active.",
  "plugin.contract":
    "frontend/src/mocks/plugins.ts:449 — createInstance selects only runnable versions and upgrades select newestRunnable, so no API action makes an instance select an unsupported contract.",
} satisfies Record<string, string>;

function collectCodes(value: unknown, found: Set<string>) {
  if (value === null || typeof value !== "object") return;
  if ("code" in value && typeof value.code === "string") found.add(value.code);
  for (const nested of Object.values(value)) collectCodes(nested, found);
}

it("records every refusal code or lists why the mock cannot reach it", () => {
  const directory = join(import.meta.dir, "recordings");
  const recordings = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")) as unknown);
  const recorded = new Set<string>();
  for (const recording of recordings) collectCodes(recording, recorded);

  const codes = [...new Set(Object.values(endpoints).flatMap((endpoint) => endpoint.codes))];
  const missing = codes.filter((code) => !recorded.has(code));
  for (const code of Object.keys(unreachable)) {
    expect(codes, `${code} is an endpoint refusal code`).toContain(code);
    expect(recorded.has(code), `${code} is still unreachable`).toBe(false);
  }
  expect(missing.toSorted()).toEqual(Object.keys(unreachable).toSorted());
});
