// A refusal's body (decided 2026-10-06).

import { z } from "zod";

// RFC 9457 Problem Details, with VERA's two extensions: `code`, a stable key a refusal is worded
// by (and translated by, later), and `errors`, the fields a 422 rejected.
export const problemSchema = z.object({
  type: z.string().default("about:blank"),
  title: z.string().optional(),
  status: z.number().int().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof problemSchema>;
