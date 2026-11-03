// Writes the plugin package descriptor schema from domain's declarationsSchema.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { configFieldSchema, declarationsSchema, pluginTriggerSchema } from "@vera/domain/plugins";
import { z } from "zod";

const target = resolve(import.meta.dir, "../plugin/vera-plugin.schema.json");
const schema = z.object({
  implementation: z.string(),
  version: z.string(),
  contractVersion: z.string(),
  triggers: z.array(pluginTriggerSchema),
  declares: declarationsSchema,
  configFields: z.array(configFieldSchema),
});
const contents = `${JSON.stringify(
  z.toJSONSchema(schema, { target: "draft-2020-12" }),
  null,
  2,
)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== contents) {
    console.error("contract/plugin/vera-plugin.schema.json is stale; run make plugin-schema");
    process.exitCode = 1;
  }
} else {
  mkdirSync(resolve(import.meta.dir, "../plugin"), { recursive: true });
  writeFileSync(target, contents);
}
