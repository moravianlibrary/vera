// An intention's mix end to end against the mock server over HTTP: the mix it chose, read inside
// its scope only (PLAN-mix-within-scope). Writing a mix is on Mixes (api/mix-catalog.test.ts).

import type { IntentionMixDetail } from "@vera/contract/mixes";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { findIntentionMix } from "@/api/mixes";
import type { MockUserProfile } from "@/config/env";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function mixOf(intentionId: string): Promise<IntentionMixDetail> {
  const detail = await findIntentionMix(intentionId);
  if (detail === null) {
    throw new Error(`No mix for ${intentionId}`);
  }

  return detail;
}

function nodeOf(detail: IntentionMixDetail, categoryId: string) {
  const node = detail.mix.nodes.find((candidate) => candidate.categoryId === categoryId);
  if (node === undefined) {
    throw new Error(`No node ${categoryId}`);
  }

  return node;
}

describe("findIntentionMix", () => {
  it("reads the mix it chose, inside its scope only", async () => {
    signInAs("digitization");

    const detail = await mixOf("i1");

    expect([detail.mix.mixId, detail.mix.mixName, detail.revision]).toEqual([
      "d2",
      "Periodicals push",
      2,
    ]);
    // The scope is 100% of itself; its own share, and everything outside, is not used.
    expect(nodeOf(detail, "c2")).toMatchObject({ share: null, ofWhole: 100 });
    expect(nodeOf(detail, "c21")).toMatchObject({ share: 55, ofWhole: 55 });
    expect(nodeOf(detail, "c1")).toMatchObject({ share: null, ofWhole: null, actual: null });
    expect(nodeOf(detail, "c2")).toMatchObject({ unallocated: 10, noShareIds: ["c23"] });
    expect(detail.mix.unallocated).toBe(0);
  });

  it("is none for an intention not listed yet, or unknown", async () => {
    signInAs("digitization");

    // A Proposed project's own intention.
    expect(await findIntentionMix("i14")).toBeNull();
    expect(await findIntentionMix("nope")).toBeNull();
  });
});
