import { z } from "zod";

const callSchema = z.object({
  as: z.string().optional(),
  method: z.string(),
  path: z.string(),
  requestBody: z.unknown().optional(),
  acceptLanguage: z.enum(["cs", "en"]).optional(),
  form: z
    .record(
      z.string(),
      z.union([z.string(), z.object({ photoBytes: z.number(), fileName: z.string().optional() })]),
    )
    .optional(),
  status: z.number().int(),
  body: z.unknown().optional(),
  code: z.string().optional(),
  text: z.string().optional(),
  contentType: z.string().optional(),
});

export function mediaTypeOf(contentType: string | null): string | undefined {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase();
}

export const recordingSchema = z.object({
  seed: z.string(),
  moment: z.iso.datetime({ offset: true }),
  mask: z.enum(["none", "decisions", "proposals"]),
  scenarios: z.array(
    z.object({
      name: z.string(),
      calls: z.array(callSchema),
    }),
  ),
});

export type Recording = z.infer<typeof recordingSchema>;
export type RecordingCall = z.infer<typeof callSchema>;
