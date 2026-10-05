// Status derivations, checked against the fixture iterations that were designed to exercise them.

import { describe, expect, it } from "vitest";
import type { Iteration } from "@/domain/entities";
import {
  iterationStatusOf,
  outstandingDefects,
  statusFootnoteOf,
  validationOf,
} from "@/domain/status";
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
    expect(outstanding.map((defect) => defect.key)).toEqual(["CatalogValidity:R07:260$c"]); // only D \ A
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
