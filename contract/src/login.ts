// How a person logs in (ACCESS-login-page): one entry per enabled Identity instance, in order.
// The protocol is the engine's (plans/engine-step-2/handoff.md §1): a form entry posts its
// credentials; a redirect entry sends the browser to GET /login/:instanceId?returnTo=, which
// goes to the provider and comes back with a session.

import { z } from "zod";

export const loginEntrySchema = z.object({
  instanceId: z.string(),
  label: z.string(),
  entry: z.enum(["form", "redirect"]),
});
export type LoginEntry = z.infer<typeof loginEntrySchema>;

export const localLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});
export type LocalLogin = z.infer<typeof localLoginSchema>;
