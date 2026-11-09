// What the server does for Digitization Lists: permission and refusal checks around a generator
// plugin call, then the draft details only VERA can assemble (intentions.md §4).

import type { GenerationDraft, GenerationRequest, ListGenerator } from "@vera/contract/lists";
import { categoryLineageOf, leafCategoriesOf } from "@vera/domain/categories";
import type { Category, Session } from "@vera/domain/entities";
import { isInIntentionScope, mixNodesOf, shareWithinOf } from "@vera/domain/intentions";
import { isInPool } from "@vera/domain/lists";
import { hasPermission } from "@vera/domain/permissions";
import type { GenerateInput } from "@vera/domain/plugin-api/list-generator";
import { database } from "@/mocks/database";
import { shapeableIntentions } from "@/mocks/intention-lists";
import { distributionOf, overallIntention } from "@/mocks/intentions";
import { generate } from "@/mocks/list-generator";
import { byPriorityThenAge, isHeldInReview, itemOf, topCategoryOf } from "@/mocks/lists";
import type { Outcome } from "@/mocks/mutations";
import { enabledInstancesOf, implementationOf } from "@/mocks/plugin-instances";
import { meetsScopeConditions } from "@/mocks/properties";

export function canGenerate(session: Session): boolean {
  return hasPermission(session, "list.create") || hasPermission(session, "list.edit");
}

// Every enabled list generator instance; its tolerance is its configuration's, "5%".
export function enabledGenerators(): ListGenerator[] {
  return enabledInstancesOf("ListGenerator").flatMap((instance) => {
    const implementation = implementationOf(instance);
    const version = implementation?.versions.find(
      (candidate) => candidate.version === instance.version,
    );
    const generatorClass = version?.declares.generatorClass ?? null;
    if (implementation === undefined || generatorClass === null) return [];
    return [
      {
        id: instance.id,
        name: instance.name,
        plugin: implementation.name,
        version: instance.version,
        generatorClass,
        description: implementation.description,
        tolerance: (Number.parseFloat(instance.configuration.tolerance ?? "") || 5) / 100,
      },
    ];
  });
}

export function generateDraft(
  session: Session,
  request: GenerationRequest,
): Outcome<GenerationDraft> {
  if (!canGenerate(session)) {
    return { refusal: { status: 403, message: "You may not build lists" } };
  }
  const generator = enabledGenerators().find((candidate) => candidate.id === request.generatorId);
  if (generator === undefined) {
    return { refusal: { status: 404, message: "No such list generator is running" } };
  }
  const shapedBy =
    request.intentionId === null
      ? overallIntention()
      : shapeableIntentions().find((intention) => intention.id === request.intentionId);
  if (shapedBy === undefined) {
    return {
      refusal: {
        status: 422,
        code: "list.intention_ended",
        message: "Shape it by an intention that is neither ended nor archived",
      },
    };
  }

  const { categories } = database;
  const scope = shapedBy.scopeCategoryId;
  const nodes = mixNodesOf(categories, scope);
  const { allocation, pages, categoryIds } = request;
  if (
    allocation !== null &&
    Object.keys(allocation).some((id) => !nodes.some((node) => node.id === id))
  ) {
    return {
      refusal: {
        status: 422,
        code: "list.allocation_outside_mix",
        message: "Allocate pages only to the categories its mix is read across",
      },
    };
  }
  const hasMix = shapedBy.distributionId !== null;
  if (!hasMix && allocation !== null) {
    return {
      refusal: {
        status: 422,
        code: "list.correction_needs_mix",
        message: "A correcting allocation needs a mix",
      },
    };
  }

  const memberIds = new Set(request.memberIds);
  const items = database.iterations.flatMap((iteration) => itemOf(iteration) ?? []);
  const fixed = items.filter((item) => memberIds.has(item.iteration.id));
  const available = items
    .filter((item) => isInPool(item.iteration) && !memberIds.has(item.iteration.id))
    // PLAN-scope: the pool is narrowed to the intention's whole scope, its conditions included.
    .filter((item) =>
      isInIntentionScope(shapedBy, item.iteration, categories, meetsScopeConditions),
    )
    .filter((item) => item.pages !== null)
    .toSorted(byPriorityThenAge);

  const leaves = leafCategoriesOf(categories).filter((leaf) => {
    if (scope === null) return true;
    return categoryLineageOf(categories, leaf.id).includes(scope);
  });
  const distribution = hasMix ? distributionOf(shapedBy) : null;
  const shareOf = (categoryId: string) =>
    distribution === null ? null : shareWithinOf(categories, distribution, scope, categoryId);
  const nodeFor = (leaf: Category) =>
    nodes.find((node) => categoryLineageOf(categories, leaf.id).includes(node.id));
  const input: GenerateInput = {
    intention: { id: shapedBy.id, name: shapedBy.name },
    hasMix,
    leaves: leaves.map((leaf) => ({
      id: leaf.id,
      name: leaf.name,
      parentId: leaf.parentId,
      topCategoryId: topCategoryOf(leaf.id),
      share: shareOf(leaf.id),
      nodeId: allocation === null ? null : (nodeFor(leaf)?.id ?? null),
    })),
    nodes: nodes.map((node) => ({ id: node.id, share: shareOf(node.id) })),
    pool: available.map(({ iteration, pages: itemPages, askedAt }) => ({
      iteration,
      pages: itemPages as number,
      askedAt,
    })),
    members: fixed.flatMap(({ iteration, pages: itemPages }) =>
      itemPages === null ? [] : [{ iteration, pages: itemPages }],
    ),
    pages,
    topCategoryIds: categoryIds,
    allocation,
  };
  const plugin = enabledInstancesOf("ListGenerator").find(
    (instance) => instance.id === generator.id,
  );
  const answer = generate(
    input,
    plugin?.configuration ?? {},
    generator.generatorClass === "AiBased",
  );
  const itemById = new Map(available.map((item) => [item.iteration.id, item]));
  const picks = answer.picks.flatMap(({ iterationId, why }) => {
    const item = itemById.get(iterationId);
    return item === undefined ? [] : [{ item, reason: why }];
  });
  const totalPages =
    fixed.reduce((sum, item) => sum + (item.pages ?? 0), 0) +
    picks.reduce((sum, { item }) => sum + (item.pages ?? 0), 0);
  const heldInReview = database.iterations.filter(isHeldInReview);
  const shortfalls = answer.shortfalls.map((shortfall) => ({
    ...shortfall,
    inReviewCount: heldInReview.filter((iteration) => iteration.categoryId === shortfall.categoryId)
      .length,
  }));

  return {
    value: {
      generator,
      shapedBy: { intentionId: shapedBy.id, name: shapedBy.name },
      picks,
      requestedPages: pages,
      totalPages,
      spreadCount: answer.spreadCount,
      shortfalls,
      provenance: {
        intentionId: shapedBy.id,
        mixId: distribution?.id ?? null,
        mixRevision: distribution?.revision ?? null,
        pages,
        allocation,
        generator: `${generator.plugin} ${generator.version}`,
        at: new Date().toISOString(),
      },
    },
  };
}
