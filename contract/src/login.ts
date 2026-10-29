// How a person logs in (ACCESS-login-page): one entry per enabled Identity instance, in order.
// The protocol is the engine's (plans/engine-step-2/handoff.md §1): a form entry posts its
// credentials; a redirect entry sends the browser to GET /login/:instanceId?returnTo=, which
// goes to the provider and comes back with a session.

import { z } from "zod";

export const loginEntrySchema = z.object({
  instanceId: z.string(),
  label: z.string(),
  entry: z.enum(["form", "redirect"]),
  // A form entry whose instance lets people create their own account (ACCESS-sign-up), and one
  // that can mail a reset link (ACCESS-password-reset). Always false for a redirect entry.
  canSignUp: z.boolean(),
  canResetPassword: z.boolean(),
});
export type LoginEntry = z.infer<typeof loginEntrySchema>;

export const localLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});
export type LocalLogin = z.infer<typeof localLoginSchema>;

// ACCESS-sign-up. `website` is the hidden field a person never fills.
export const signUpSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  username: z.string().trim().min(1),
  password: z.string(),
  website: z.string().optional(),
  returnTo: z.string().optional(),
});
export type SignUp = z.infer<typeof signUpSchema>;

export const emailOnlySchema = z.object({ email: z.email() });
export const tokenSchema = z.object({ token: z.string().min(1) });
export const passwordResetSchema = z.object({ token: z.string().min(1), password: z.string() });
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export const verifiedSchema = z.object({ returnTo: z.string() });
