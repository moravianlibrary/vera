// Writes the seed formats the backend loader reads.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { seedPatchSchema, seedSchema } from "../seed/seed.ts";

const root = resolve(import.meta.dir, "../..");
const outputs = [
  [resolve(root, "contract/seed/seed.schema.json"), seedSchema],
  [resolve(root, "contract/seed/seed-patch.schema.json"), seedPatchSchema],
] as const;
for (const [path, schema] of outputs) {
  const json = `${JSON.stringify(z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" }), null, 2)}\n`;
  const formatted = spawnSync("bunx", ["biome", "format", `--stdin-file-path=${path}`], {
    input: json,
    encoding: "utf8",
  });
  if (formatted.status !== 0) throw new Error(`Could not format ${path}: ${formatted.stderr}`);
  const contents = formatted.stdout;
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== contents) {
      console.error(`${path} is stale; run make seed-schema`);
      process.exitCode = 1;
    }
  } else writeFileSync(path, contents);
}
