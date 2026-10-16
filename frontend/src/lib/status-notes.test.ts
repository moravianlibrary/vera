// Status notes and desks, checked against the fixture iterations that were designed to exercise
// them, for both audiences.

import type { DocumentRecord } from "@vera/domain/documents";
import type { Iteration, Request } from "@vera/domain/entities";
import { describe, expect, it } from "vitest";
import { deskOf, iterationNoteOf } from "@/lib/status-notes";
import { documents } from "@/mocks/fixtures/documents";
import { iterations } from "@/mocks/fixtures/iterations";
import { requests } from "@/mocks/fixtures/requests";

function iteration(id: string): Iteration {
  const found = iterations.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No fixture iteration "${id}"`);
  }

  return found;
}

function originOf(attempt: Iteration): Request | null {
  return requests.find((request) => request.id === attempt.requestId) ?? null;
}

function recordOf(attempt: Iteration): DocumentRecord {
  const document = documents.find((candidate) => candidate.id === attempt.documentId);
  if (document === undefined) {
    throw new Error(`No fixture document "${attempt.documentId}"`);
  }

  return {
    document,
    iterations: iterations
      .filter((candidate) => candidate.documentId === document.id)
      .toSorted((first, second) => first.attempt - second.attempt),
    requests: requests.filter((request) => request.documentId === document.id),
  };
}

describe("iterationNoteOf", () => {
  it("lists the outstanding defects for staff, in the plugin's terms", () => {
    const attempt = iteration("IT18");

    const note = iterationNoteOf(attempt, originOf(attempt), "staff");

    expect(note?.title).toBe("Review needed");
    expect(note?.tone).toBe("amber");
    expect(note?.text).toContain("CatalogValidity R07");
  });

  it("tells a requester only that it is being checked, in public words", () => {
    const attempt = iteration("IT18");

    const note = iterationNoteOf(attempt, null, "public");

    expect(note?.title).toBe("Being checked");
    expect(note?.text).not.toContain("CatalogValidity");
  });

  it("keeps a failed ingest from a requester", () => {
    const attempt = iteration("IT7");

    expect(iterationNoteOf(attempt, originOf(attempt), "staff")?.title).toBe("Could not be added");
    expect(iterationNoteOf(attempt, null, "public")).toBeNull();
  });

  it("lets a restriction outrank an outstanding defect", () => {
    const attempt = iteration("IT14");

    expect(iterationNoteOf(attempt, originOf(attempt), "staff")?.title).toBe("Forbidden");
  });

  it("names a denial in review as on hold for a requester", () => {
    const attempt = iteration("IT11");

    expect(iterationNoteOf(attempt, originOf(attempt), "staff")?.title).toBe("Denied in review");
    expect(iterationNoteOf(attempt, null, "public")?.title).toBe("On hold");
  });

  it("warns staff of a copy found after approval", () => {
    const attempt = iteration("IT15");

    const note = iterationNoteOf(attempt, originOf(attempt), "staff");

    expect(note?.title).toBe("Copy found after approval");
    expect(iterationNoteOf(attempt, null, "public")).toBeNull();
  });
});

describe("deskOf", () => {
  it.each([
    ["IT10", "validations"],
    ["IT5", "lists"],
    ["IT7", "documents"],
    ["IT14", null],
    ["IT20", null],
    // A defect found after the scan sends it back to review.
    ["IT1", "validations"],
  ] as const)("puts %s on %s", (id, expected) => {
    expect(deskOf(recordOf(iteration(id)))).toBe(expected);
  });
});
