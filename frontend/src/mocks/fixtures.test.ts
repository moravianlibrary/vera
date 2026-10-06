// The fixtures are the fake backend's database: every record must parse as the API would send it,
// and every reference must point at a record that exists.

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { followedIterationId } from "@/domain/documents";
import {
  batchSchema,
  categorySchema,
  digitizationListSchema,
  distributionSchema,
  documentSchema,
  intentionSchema,
  intentionTemplateSchema,
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
    ["intentions", z.array(intentionSchema), database.intentions],
    ["mixes", z.array(distributionSchema), database.distributions],
    ["repeats", z.array(intentionTemplateSchema), database.intentionTemplates],
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

  // intentions.md §2: a mix comes from an intention that owns it, one step away.
  it("give every mix one owner and no tracking chains", () => {
    const owners = database.intentions.filter((intention) => intention.tracksMixOf === null);
    const projectIds = new Set(database.projects.map((project) => project.id));
    const categoryIds = new Set(database.categories.map((category) => category.id));

    expect(database.intentions.filter((intention) => intention.isOverall)).toHaveLength(1);
    expect(
      database.distributions.map((distribution) => [
        distribution.id,
        owners.find((owner) => owner.distributionId === distribution.id)?.id,
      ]),
    ).toEqual(
      database.distributions.map((distribution) => [distribution.id, distribution.ownerId]),
    );
    for (const intention of [...database.intentions, ...database.intentionTemplates]) {
      const owner = owners.find((candidate) => candidate.id === intention.tracksMixOf);
      if (intention.tracksMixOf !== null) {
        expect(owner?.distributionId).toBe(intention.distributionId);
      }

      expect(
        intention.funding.kind !== "project" || projectIds.has(intention.funding.projectId),
      ).toBe(true);
      expect(intention.scopeCategoryId === null || categoryIds.has(intention.scopeCategoryId)).toBe(
        true,
      );
    }

    const templateIds = new Set(database.intentionTemplates.map((template) => template.id));

    expect(
      database.intentions.every(
        (intention) => intention.templateId === null || templateIds.has(intention.templateId),
      ),
    ).toBe(true);
  });
});
