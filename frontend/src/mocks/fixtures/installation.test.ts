// L11: the mock's shipped roles are the installation seed's roles.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { roles } from "@/mocks/fixtures/access";

const installation = JSON.parse(
  readFileSync(join(process.cwd(), "../seeds/installation.json"), "utf8"),
);

it("holds the roles in the installation seed", () => {
  expect(installation.collections.roles).toEqual(JSON.parse(JSON.stringify(roles)));
});
