// What the Message plugins (docs/demos/shared/vera-data.js pt23, pt24; messaging.md §2) need of a
// person to reach them; the instances are Plugins' (fixtures/plugins.ts). Email needs an address
// from the user record; Slack needs a handle, the `slack_id` claim of the person's MZK Keycloak
// identity, which only those who sign in with it carry. Both hand off as a redirect, pre-filled.

export type MessageImplementation = "mailto" | "slack";

// The `slack_id` claim, by user: everyone signing in with MZK Keycloak (vera-data.js users).
export const slackHandles: Readonly<Record<string, string>> = {
  u1: "jnovakova",
  u2: "msvoboda",
  u3: "pdvorak",
  u4: "ehorakova",
  u8: "knovotna",
  u9: "rsimek",
};

export const slackWorkspace = "mzk";
