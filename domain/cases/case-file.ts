// The JSON cases shared with the Java domain module (B3).

import { z } from "zod";

const jsonValueSchema: z.ZodType<z.JSONType> = z.json();

export const caseFileSchema = z.object({
  function: z.string(),
  base: z.record(z.string(), jsonValueSchema).optional(),
  cases: z.array(
    z.object({
      name: z.string(),
      rule: z.string().nullable(),
      input: z.record(z.string(), jsonValueSchema),
      expected: jsonValueSchema,
    }),
  ),
});

export const caseFileJsonSchema = z.toJSONSchema(caseFileSchema, { target: "draft-2020-12" });
