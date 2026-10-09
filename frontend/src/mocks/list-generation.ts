// What a list generator plugin does, played by the mock (intentions.md §4, plugins.md §4.9): the
// reference rule-based generator, and the AI-based one answering with the same picks in its own
// words. Per leaf category it fills the mix's share of the pages, highest priority first and then
// the oldest ask, never splitting a document. A share it cannot fill is shortfall: re-spread to
// categories that still have supply, nearest first and never into one at 0%, and reported with
// why. Current members stay fixed; it tops up. Nothing is saved: the result is a draft.
// One intention shapes it (Overall unless another is picked): the pool narrows to its funding and
// subtree, and its mix is read inside its scope. A correcting run's allocation fixes the pages of
// each category the mix is read across, split below by the shares; what it cannot fill stays
// short there, never re-spread (STATUS "Intentions").

import type {
  GenerationDraft,
  GenerationRequest,
  ListGenerator,
  ListItem,
  ShortfallCause,
} from "@/api/lists";
import { categoryLineageOf, leafCategoriesOf } from "@/domain/categories";
import type { Category, Session } from "@/domain/entities";
import { isInIntentionScope, mixNodesOf, shareWithinOf } from "@/domain/intentions";
import { isInPool } from "@/domain/lists";
import { hasPermission } from "@/domain/permissions";
import { formatShortCalendarDay } from "@/lib/format-date";
import { database } from "@/mocks/database";
import { advisorReasons } from "@/mocks/fixtures/list-generators";
import { shapeableIntentions } from "@/mocks/intention-lists";
import { distributionOf, overallIntention } from "@/mocks/intentions";
import { byPriorityThenAge, isHeldInReview, itemOf, topCategoryOf } from "@/mocks/lists";
import type { Outcome } from "@/mocks/mutations";
import { enabledInstancesOf, implementationOf } from "@/mocks/plugin-instances";

// A little slack on a category's own goal, so one document just over it is still taken.
const pageSlack = 50;

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
    if (implementation === undefined || generatorClass === null) {
      return [];
    }

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
        message: "Shape it by an intention that is neither ended nor archived",
      },
    };
  }

  const { categories } = database;
  const scope = shapedBy.scopeCategoryId;
  const nodes = mixNodesOf(categories, scope);
  const { allocation } = request;
  if (
    allocation !== null &&
    Object.keys(allocation).some((id) => !nodes.some((node) => node.id === id))
  ) {
    return {
      refusal: {
        status: 422,
        message: "Allocate pages only to the categories its mix is read across",
      },
    };
  }

  const { pages, categoryIds } = request;
  const tolerance = generator.tolerance;
  const isAdvisor = generator.generatorClass === "AiBased";
  const memberIds = new Set(request.memberIds);
  const items = database.iterations.flatMap((iteration) => itemOf(iteration) ?? []);
  const fixed = items.filter((item) => memberIds.has(item.iteration.id));
  const available = items
    .filter((item) => isInPool(item.iteration) && !memberIds.has(item.iteration.id))
    .filter((item) => isInIntentionScope(shapedBy, item.iteration, categories))
    .filter((item) => item.pages !== null)
    .toSorted(byPriorityThenAge);
  if (shapedBy.distributionId === null) {
    if (allocation !== null)
      return { refusal: { status: 422, message: "A correcting allocation needs a mix" } };
    const picked: { item: ListItem; reason: string }[] = [];
    let total = fixed.reduce((sum, item) => sum + (item.pages ?? 0), 0);
    for (const item of available) {
      if (total >= pages || total + (item.pages ?? 0) > pages * (1 + tolerance) + pageSlack)
        continue;
      if (categoryIds.length > 0 && !categoryIds.includes(topCategoryOf(item.iteration.categoryId)))
        continue;
      picked.push({
        item,
        reason: `${item.iteration.priority} priority · asked ${formatShortCalendarDay(item.askedAt.slice(0, 10))}`,
      });
      total += item.pages ?? 0;
    }
    return {
      value: {
        generator,
        shapedBy: { intentionId: shapedBy.id, name: shapedBy.name },
        picks: picked,
        requestedPages: pages,
        totalPages: total,
        spreadCount: 0,
        shortfalls: [],
        provenance: {
          intentionId: shapedBy.id,
          mixId: null,
          mixRevision: null,
          pages,
          allocation: null,
          generator: `${generator.plugin} ${generator.version}`,
          at: new Date().toISOString(),
        },
      },
    };
  }
  const isUnder = (categoryId: string, ancestorId: string) =>
    categoryLineageOf(categories, categoryId).includes(ancestorId);
  const leaves = leafCategoriesOf(categories).filter(
    (leaf) => scope === null || isUnder(leaf.id, scope),
  );
  const distribution = distributionOf(shapedBy);
  const shareOf = (categoryId: string) =>
    shareWithinOf(categories, distribution, scope, categoryId);
  // Its share of the pages, or its node's allocated pages split by the shares below the node.
  const goalOf = (leaf: Category) => {
    const share = shareOf(leaf.id) ?? 0;
    if (allocation === null) {
      return (pages * share) / 100;
    }

    const node = nodes.find((candidate) => isUnder(leaf.id, candidate.id));
    const nodeShare = node === undefined ? 0 : (shareOf(node.id) ?? 0);
    return node === undefined || nodeShare === 0
      ? 0
      : ((allocation[node.id] ?? 0) * share) / nodeShare;
  };
  const isAllowed = (categoryId: string) =>
    categoryIds.length === 0 || categoryIds.includes(topCategoryOf(categoryId));
  const pagesIn = (categoryId: string, of: readonly ListItem[]) =>
    of
      .filter((item) => item.iteration.categoryId === categoryId)
      .reduce((sum, item) => sum + (item.pages ?? 0), 0);

  const picks: { item: ListItem; reason: string }[] = [];
  const picked = new Set<string>();
  let total = fixed.reduce((sum, item) => sum + (item.pages ?? 0), 0);
  const got = new Map(leaves.map((leaf) => [leaf.id, pagesIn(leaf.id, fixed)]));
  const goal = new Map(leaves.map((leaf) => [leaf.id, goalOf(leaf)]));
  const take = (item: ListItem, covers: Category | null) => {
    const asked = `${item.iteration.priority} priority · asked ${formatShortCalendarDay(item.askedAt.slice(0, 10))}`;
    const isInPlaceOf = covers !== null && covers.id !== item.iteration.categoryId;
    const rule = isInPlaceOf ? `${asked} · covers ${covers.name}` : asked;
    picks.push({
      item,
      reason: isAdvisor ? (advisorReasons[item.iteration.id] ?? "Fits the mix.") : rule,
    });
    picked.add(item.iteration.id);
    total += item.pages ?? 0;
    const category = item.iteration.categoryId;
    got.set(category, (got.get(category) ?? 0) + (item.pages ?? 0));
  };

  // Each leaf to its share.
  for (const leaf of leaves) {
    const target = goal.get(leaf.id) ?? 0;
    if ((shareOf(leaf.id) ?? 0) === 0 || !isAllowed(leaf.id)) {
      continue;
    }

    for (const item of available.filter(
      (candidate) => candidate.iteration.categoryId === leaf.id,
    )) {
      const filled = got.get(leaf.id) ?? 0;
      if (filled < target && filled + (item.pages ?? 0) <= target * (1 + tolerance) + pageSlack) {
        take(item, null);
      }
    }
  }

  const shortOf = (categoryId: string) => {
    const target = goal.get(categoryId) ?? 0;
    const missing = target - (got.get(categoryId) ?? 0);
    return missing > target * tolerance ? missing : 0;
  };

  // A share that cannot be filled goes to categories that still have supply, nearest first; a
  // correcting run stays short instead.
  let spreadCount = 0;
  const short = allocation === null ? leaves.filter((leaf) => shortOf(leaf.id) > 0) : [];
  for (const leaf of short.toSorted((first, second) => shortOf(second.id) - shortOf(first.id))) {
    let need = shortOf(leaf.id);
    const distanceOf = (item: ListItem) => {
      const category = categories.find((candidate) => candidate.id === item.iteration.categoryId);
      if (category?.parentId === leaf.parentId) {
        return 0;
      }

      return topCategoryOf(item.iteration.categoryId) === topCategoryOf(leaf.id) ? 1 : 2;
    };
    const candidates = available
      .filter((item) => !picked.has(item.iteration.id))
      .filter((item) => isAllowed(item.iteration.categoryId))
      .filter((item) => (shareOf(item.iteration.categoryId) ?? 0) > 0)
      .toSorted((first, second) => distanceOf(first) - distanceOf(second));
    for (const item of candidates) {
      if (need > 0 && total + (item.pages ?? 0) <= pages * (1 + tolerance)) {
        take(item, leaf);
        need -= item.pages ?? 0;
        spreadCount += item.iteration.categoryId === leaf.id ? 0 : 1;
      }
    }
  }

  const heldInReview = database.iterations.filter(isHeldInReview);
  const shortfalls = leaves.flatMap((leaf) => {
    const missing = shortOf(leaf.id);
    const hasSupplyLeft = available.some(
      (item) => item.iteration.categoryId === leaf.id && !picked.has(item.iteration.id),
    );
    const cause = causeOf(missing, shareOf(leaf.id), isAllowed(leaf.id), hasSupplyLeft);
    return cause === null
      ? []
      : [
          {
            categoryId: leaf.id,
            pages: Math.round(missing),
            cause,
            inReviewCount: heldInReview.filter((iteration) => iteration.categoryId === leaf.id)
              .length,
          },
        ];
  });

  return {
    value: {
      generator,
      shapedBy: { intentionId: shapedBy.id, name: shapedBy.name },
      picks,
      requestedPages: pages,
      totalPages: total,
      spreadCount,
      shortfalls,
      provenance: {
        intentionId: shapedBy.id,
        mixId: distribution.id,
        mixRevision: distribution.revision,
        pages,
        allocation,
        generator: `${generator.plugin} ${generator.version}`,
        at: new Date().toISOString(),
      },
    },
  };
}

function causeOf(
  missing: number,
  share: number | null,
  isAllowed: boolean,
  hasSupplyLeft: boolean,
): ShortfallCause | null {
  if (share === null) {
    return "unallocated";
  }

  if (missing === 0) {
    return null;
  }

  if (!isAllowed) {
    return "leftOut";
  }

  return hasSupplyLeft ? "overshoot" : "noSupply";
}
