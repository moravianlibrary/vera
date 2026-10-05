// The fixtures are the fake backend's database: every record must parse as the API would send it,
// and every reference must point at a record that exists.

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { followedIterationId } from "@/domain/documents";
import {
  batchSchema,
  categorySchema,
  digitizationListSchema,
  documentSchema,
  iterationSchema,
  projectSchema,
  requestSchema,
  statusLogEntrySchema,
  userSchema,
} from "@/domain/entities";
import { database } from "@/mocks/database";

describe("fixtures", () => {
  it.each([
    ["users", z.array(userSchema), database.users],
    ["categories", z.array(categorySchema), database.categories],
    ["projects", z.array(projectSchema), database.projects],
    ["lists", z.array(digitizationListSchema), database.lists],
    ["batches", z.array(batchSchema), database.batches],
    ["documents", z.array(documentSchema), database.documents],
    ["iterations", z.array(iterationSchema), database.iterations],
    ["requests", z.array(requestSchema), database.requests],
    ["status log", z.array(statusLogEntrySchema), database.statusLog],
  ] as const)("parse %s against the API schema", (_name, schema, records) => {
    const result = schema.safeParse(records);

    expect(result.error).toBeUndefined();
  });

  it("reference only records that exist", () => {
    const ids = new Set(
      [
        database.users,
        database.categories,
        database.projects,
        database.lists,
        database.batches,
        database.documents,
        database.iterations,
        database.requests,
      ].flatMap((records) => records.map((record) => record.id)),
    );
    const references = [
      ...database.iterations.flatMap((iteration) => [
        iteration.documentId,
        iteration.requestId,
        iteration.categoryId,
        iteration.projectId,
        iteration.listId,
      ]),
      ...database.requests.flatMap((request) => [
        request.documentId,
        request.requesterId,
        request.batchId,
        request.projectId,
        followedIterationId(request),
      ]),
    ].filter((reference) => reference !== null);

    const dangling = references.filter((reference) => !ids.has(reference));

    expect(dangling).toEqual([]);
  });
});
