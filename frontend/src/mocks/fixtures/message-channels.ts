// The Message plugin instances (docs/demos/shared/vera-data.js pt23, pt24; messaging.md §2) and
// what each needs of a person to reach them. Email needs an address from the user record; Slack
// needs a handle, the `slack_id` claim of the person's MZK Keycloak identity, which only those
// who sign in with it carry. Both hand off as a redirect, pre-filled, in their configured order.

export type MessageImplementation = "mailto" | "slack";

export interface MessageInstance {
  readonly id: string;
  readonly name: string;
  readonly implementation: MessageImplementation;
  readonly order: number;
  readonly isEnabled: boolean;
}

export const messageInstances: readonly MessageInstance[] = [
  { id: "pi26", name: "Email", implementation: "mailto", order: 1, isEnabled: true },
  { id: "pi27", name: "MZK Slack", implementation: "slack", order: 2, isEnabled: true },
];

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
