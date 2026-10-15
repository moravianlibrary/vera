// Messaging end to end against the mock server over HTTP: the Message instances in their order,
// who a message about a proposal or a restriction goes to, whom each instance can reach and where it hands off,
// and that a record the caller cannot see has nobody to message.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import { listMessageChannels, prepareMessage } from "@/api/messages";
import type { MockUserProfile } from "@/config/env";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function statusOf(call: Promise<unknown>): Promise<number | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? error.status : null;
  }
}

describe("listMessageChannels", () => {
  it("offers the enabled Message instances in their order", async () => {
    signInAs("curator");

    const channels = await listMessageChannels();

    expect(channels.map((channel) => channel.name)).toEqual(["Email", "MZK Slack"]);
  });
});

describe("prepareMessage", () => {
  it("sends a proposal's message to everyone who asked for it", async () => {
    signInAs("admin");

    const handOff = await prepareMessage({ kind: "proposal", id: "D20" });

    expect(handOff.recipients.map((recipient) => recipient.userId).toSorted()).toEqual([
      "u4",
      "u5",
      "u6",
      "u7",
    ]);
    expect(handOff.about.path).toBe("/requests?id=D20");
    expect(handOff.context).toContain("4 asks");
  });

  it("says whom each instance reaches, and hands off pre-filled", async () => {
    signInAs("admin");

    const handOff = await prepareMessage({ kind: "proposal", id: "D20" });
    const [email, slack] = handOff.handOffs;

    expect(email?.reachableIds).toHaveLength(4);
    expect(email?.href).toMatch(/^mailto:[^?]*eva\.horakova@mzk\.cz[^?]*\?subject=%5BVERA%5D/);
    expect(email?.href).toContain(encodeURIComponent("/requests?id=D20")); // the link back
    expect(slack?.reachableIds).toEqual(["u4"]); // only Eva signs in with MZK Keycloak
  });

  it("leaves out an agent, so a harvester's proposal reaches nobody", async () => {
    signInAs("admin");

    const handOff = await prepareMessage({ kind: "proposal", id: "D22" });

    expect(handOff.recipients).toEqual([]);
    expect(handOff.handOffs.every((channel) => channel.href === null)).toBe(true);
  });

  it("finds nothing to message about outside the caller's reach", async () => {
    signInAs("staff");

    expect(await statusOf(prepareMessage({ kind: "proposal", id: "D31" }))).toBe(404);
  });

  it("sends a forbidden item's message to those who may overrule it", async () => {
    signInAs("curator");

    const handOff = await prepareMessage({ kind: "restriction", id: "IT14" });

    expect(handOff.recipients.map((recipient) => recipient.name)).toEqual(["Petr Dvořák"]);
    expect(handOff.context).toMatch(/^Forbidden by Copyright: /);
    expect(handOff.about.path).toContain("/review/documents?id=IT14");
  });

  it("has no restriction to message about on an item no rule forbade", async () => {
    signInAs("curator");

    expect(await statusOf(prepareMessage({ kind: "restriction", id: "IT16" }))).toBe(404);
  });
});
