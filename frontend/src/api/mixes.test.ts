// An intention's mix end to end against the mock server over HTTP: read through a tracker from its
// owner and inside a scope only; written one sibling set at a time, whole, on the owner, against
// the revision read; the trackers kept on the old mix detached in the same write; and a tracker
// detached on its own.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/api/http";
import type { IntentionMixDetail, MixSetDraft } from "@/api/mixes";
import { detachIntention, findIntentionMix, saveMixSet } from "@/api/mixes";
import type { MockUserProfile } from "@/config/env";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function refusalOf(call: Promise<unknown>): Promise<[number, string | undefined] | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? [error.status, error.problem?.code] : null;
  }
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

// Periodicals push's set under Periodicals, as the fixtures have it: Specialist has no share.
const periodicals = (patch: Partial<MixSetDraft> = {}): MixSetDraft => ({
  parentId: "c2",
  shares: { c21: 55, c22: 35, c23: null },
  revision: 2,
  keepOldMixFor: [],
  ...patch,
});

describe("findIntentionMix", () => {
  it("reads a tracker's owner's mix, inside its scope only, with every tracker", async () => {
    signInAs("digitization");

    const detail = await mixOf("i1");

    expect(detail.mix.owner.id).toBe("i8");
    expect(detail.revision).toBe(2);
    expect(detail.trackers.map(({ intention }) => intention.id).toSorted()).toEqual(["i1", "i3"]);
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

describe("saveMixSet", () => {
  it("is written only on the owner, Overall's only with intention.edit_overall", async () => {
    signInAs("digitization");

    expect(await refusalOf(saveMixSet("i1", periodicals()))).toEqual([409, "intention.not_owner"]);
    expect(
      await refusalOf(
        saveMixSet("i4", {
          parentId: "c3",
          shares: { c31: 50, c32: 50 },
          revision: 4,
          keepOldMixFor: [],
        }),
      ),
    ).toEqual([403, "forbidden"]);
  });

  it("refuses a set over 100, one naming other children, and one outside the scope", async () => {
    signInAs("digitization");

    expect(
      await refusalOf(saveMixSet("i8", periodicals({ shares: { c21: 70, c22: 35, c23: null } }))),
    ).toEqual([422, "mix.over"]);
    expect((await refusalOf(saveMixSet("i8", periodicals({ shares: { c21: 55 } }))))?.[0]).toBe(
      422,
    );
    expect(
      await refusalOf(
        saveMixSet(
          "i8",
          periodicals({ parentId: null, shares: { c1: 20, c2: 70, c3: 10, c4: 0 } }),
        ),
      ),
    ).toEqual([422, "mix.outside_scope"]);
  });

  it("changes it for every tracker, but detaches those kept on the old mix first", async () => {
    signInAs("digitization");

    const saved = await saveMixSet(
      "i8",
      periodicals({ shares: { c21: 50, c22: 30, c23: 20 }, keepOldMixFor: ["i1"] }),
    );

    expect(saved.revision).toBe(3);
    expect(nodeOf(saved, "c23").share).toBe(20);
    expect(saved.trackers.map(({ intention }) => intention.id)).toEqual(["i3"]);
    const kept = await mixOf("i1");
    expect(kept.mix.owner.id).toBe("i1");
    expect(kept.revision).toBe(1);
    expect(nodeOf(kept, "c21").share).toBe(55);
    expect(nodeOf(await mixOf("i3"), "c21").ofWhole).toBe(100);
  });

  it("refuses a write against a revision somebody replaced", async () => {
    signInAs("digitization");

    expect(await refusalOf(saveMixSet("i8", periodicals()))).toEqual([409, "mix.revision"]);
  });

  it("lets admin write Overall's", async () => {
    signInAs("admin");

    const saved = await saveMixSet("i4", {
      parentId: "c3",
      shares: { c31: 70, c32: 30 },
      revision: 4,
      keepOldMixFor: [],
    });

    expect(saved.revision).toBe(5);
    expect(nodeOf(await mixOf("i6"), "c31").share).toBe(70);
  });
});

describe("detachIntention", () => {
  it("gives a tracker its own copy, and nothing else changes", async () => {
    signInAs("digitization");

    const detached = await detachIntention("i3");

    expect(detached.mix.owner.id).toBe("i3");
    expect(detached.trackers).toEqual([]);
    expect((await mixOf("i8")).trackers).toEqual([]);
    expect(await refusalOf(detachIntention("i3"))).toEqual([409, "intention.owner"]);
  });
});
