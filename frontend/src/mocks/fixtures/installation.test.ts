// L11: the mock's shipped roles are the engine's installation roles, until the mock is retired.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { roles } from "@/mocks/fixtures/access";

const installation = JSON.parse(
  readFileSync(join(process.cwd(), "../engine/seeds/installation.json"), "utf8"),
);

it("holds the roles the engine installs", () => {
  expect(installation.collections.roles).toEqual(JSON.parse(JSON.stringify(roles)));
});
