// Copies of the fixtures stay coherent: unique IDs, and every reference lands inside its copy.

import { followedIterationId } from "@vera/domain/documents";
import { describe, expect, it } from "vitest";
import { documents } from "@/mocks/fixtures/documents";
import { iterations } from "@/mocks/fixtures/iterations";
import { requests } from "@/mocks/fixtures/requests";
import { statusLog } from "@/mocks/fixtures/status-log";
import { withCopies } from "@/mocks/volume";

const fixtures = { documents, iterations, requests, statusLog };

describe("withCopies", () => {
  it("repeats every record, each under an ID of its own", () => {
    const copied = withCopies(fixtures, 3);

    expect(copied.documents).toHaveLength(documents.length * 3);
    const ids = [...copied.documents, ...copied.iterations, ...copied.requests].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps each copy's references inside that copy", () => {
    const copied = withCopies(fixtures, 2);
    const documentIds = new Set(copied.documents.map(({ id }) => id));
    const iterationIds = new Set(copied.iterations.map(({ id }) => id));
    const requestIds = new Set(copied.requests.map(({ id }) => id));

    const copiedIterations = copied.iterations.filter(({ id }) => id.endsWith(".2"));
    const copiedRequests = copied.requests.filter(({ id }) => id.endsWith(".2"));
    expect(
      copiedIterations.every(
        (iteration) =>
          documentIds.has(iteration.documentId) &&
          iteration.documentId.endsWith(".2") &&
          requestIds.has(iteration.requestId),
      ),
    ).toBe(true);
    expect(
      copiedRequests.every((request) => {
        const followed = followedIterationId(request);
        return followed === null || (iterationIds.has(followed) && followed.endsWith(".2"));
      }),
    ).toBe(true);
  });

  it("leaves the fixtures alone with one copy", () => {
    expect(withCopies(fixtures, 1).documents).toEqual(documents);
  });
});
