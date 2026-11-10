// Writes the shared event catalogue and payload schemas from domain's event declarations.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  configurationDataSchema,
  eventCatalogue,
  historyCodes,
  historyDataSchemas,
} from "@vera/domain/events";
import { z } from "zod";
import { hookPayloadSchema } from "../src/hooks";

const target = resolve(import.meta.dir, "../events/catalogue.json");
const payloadTarget = resolve(import.meta.dir, "../events/hook-payload.schema.json");
const codes = Object.entries(eventCatalogue).map(([code, flags]) => ({ code, ...flags }));
const historyData = Object.fromEntries(
  historyCodes.map((code) => [
    code,
    z.toJSONSchema(historyDataSchemas[code], { target: "draft-2020-12" }),
  ]),
);
const contents = `${JSON.stringify(
  {
    codes,
    historyData,
    configurationData: z.toJSONSchema(configurationDataSchema, { target: "draft-2020-12" }),
  },
  null,
  2,
)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== contents) {
    console.error("contract/events/catalogue.json is stale; run make event-catalogue");
    process.exitCode = 1;
  }
  const payloadContents = `${JSON.stringify(
    z.toJSONSchema(hookPayloadSchema, { target: "draft-2020-12" }),
    null,
    2,
  )}\n`;
  if (readFileSync(payloadTarget, "utf8") !== payloadContents) {
    console.error("contract/events/hook-payload.schema.json is stale; run make event-catalogue");
    process.exitCode = 1;
  }
} else {
  mkdirSync(resolve(import.meta.dir, "../events"), { recursive: true });
  writeFileSync(target, contents);
  writeFileSync(
    payloadTarget,
    `${JSON.stringify(z.toJSONSchema(hookPayloadSchema, { target: "draft-2020-12" }), null, 2)}\n`,
  );
}
