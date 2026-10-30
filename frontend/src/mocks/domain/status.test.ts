// Status derivations, checked against the fixture iterations that were designed to exercise them.

import type { Iteration } from "@vera/domain/entities";
import { progressAfterGates } from "@vera/domain/iterations";
import {
  iterationStatusOf,
  outstandingDefects,
  statusFootnoteOf,
  validationOf,
} from "@vera/domain/status";
import { describe, expect, it } from "vitest";
import { iterations } from "@/mocks/fixtures/iterations";

function iteration(id: string): Iteration {
  const found = iterations.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No fixture iteration "${id}"`);
  }

  return found;
}

describe("validationOf", () => {
  it("stays approved when a re-check finds only accepted defects", () => {
    const accepted = iteration("IT3");

    const validation = validationOf(accepted);

    expect(validation).toBe("Approved"); // D ⊆ A
  });

  it("needs review again when a re-check finds something new", () => {
    const changedUpstream = iteration("IT18");

    const outstanding = outstandingDefects(changedUpstream);

    expect(validationOf(changedUpstream)).toBe("Needed");
    expect(outstanding.map((defect) => defect.key)).toEqual(["pi9:R07:260$c"]); // only D \ A
  });

  it("needs review again once an acceptance is revoked, the table only appended to", () => {
    const accepted = iteration("IT3");
    const revoked: Iteration = {
      ...accepted,
      verdicts: [
        ...accepted.verdicts,
        {
          defectKeys: ["pi44:R02:pages"],
          verdict: "Revoked",
          actorId: "u1",
          at: "2026-06-24T09:00:00Z",
          note: "",
          publicText: null,
        },
      ],
    };

    expect(validationOf(revoked)).toBe("Needed");
    expect(progressAfterGates(revoked)).toBe("Enqueued"); // fails a gate after Ready (V14)
  });
});

describe("iterationStatusOf", () => {
  it.each([
    ["IT3", "Ready"],
    ["IT5", "InProgress"],
    ["IT7", "IngestFailed"],
    ["IT9", "Cancelled"],
    ["IT10", "ReviewNeeded"],
    ["IT11", "ValidationDenied"],
    ["IT14", "Forbidden"],
    ["IT1", "Published"],
  ] as const)("shows %s as %s", (id, expected) => {
    const status = iterationStatusOf(iteration(id));

    expect(status).toBe(expected);
  });

  it("lets a restriction outrank an outstanding defect", () => {
    const forbiddenAndDefective = iteration("IT14");

    expect(validationOf(forbiddenAndDefective)).toBe("Needed");
    expect(iterationStatusOf(forbiddenAndDefective)).toBe("Forbidden"); // §4: Forbidden is never hidden
  });
});

describe("statusFootnoteOf", () => {
  it("carries a new defect beside a published badge instead of replacing it", () => {
    const published = iteration("IT1");

    const footnote = statusFootnoteOf(published);

    expect(footnote).toBe("ReviewNeeded"); // "Published · review needed"
  });
});
