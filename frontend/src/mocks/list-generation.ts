// What a list generator plugin does, played by the mock (intentions.md §4, plugins.md §4.9): the
// reference rule-based generator, and the AI-based one answering with the same picks in its own
// words. Per leaf category it fills the mix's share of the pages, highest priority first and then
// the oldest ask, never splitting a document. A share it cannot fill is shortfall: re-spread to
// categories that still have supply, nearest first and never into one at 0%, and reported with
// why. Current members stay fixed; it tops up. Nothing is saved: the result is a draft.

import type { GenerationDraft, GenerationRequest, ListItem, ShortfallCause } from "@/api/lists";
import { leafCategoriesOf } from "@/domain/categories";
import type { Category, Session } from "@/domain/entities";
import { effectiveShareOf } from "@/domain/mixes";
import { hasPermission } from "@/domain/permissions";
import { formatShortCalendarDay } from "@/lib/format-date";
import { database } from "@/mocks/database";
import { advisorReasons, listGenerators } from "@/mocks/fixtures/list-generators";
import { distributionOf, overallIntention } from "@/mocks/intentions";
import { byPriorityThenAge, isHeldInReview, isInPool, itemOf, topCategoryOf } from "@/mocks/lists";
import type { Outcome } from "@/mocks/mutations";

// A little slack on a category's own goal, so one document just over it is still taken.
const pageSlack = 50;

export function canGenerate(session: Session): boolean {
  return hasPermission(session, "list.create") || hasPermission(session, "list.edit");
}

export function enabledGenerators() {
  return listGenerators
    .filter((generator) => generator.isEnabled)
    .map(({ isEnabled: _isEnabled, ...generator }) => generator);
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

  const { pages, categoryIds } = request;
  const tolerance = generator.tolerance;
  const isAdvisor = generator.generatorClass === "AiBased";
  const memberIds = new Set(request.memberIds);
  const items = database.iterations.flatMap((iteration) => itemOf(iteration) ?? []);
  const fixed = items.filter((item) => memberIds.has(item.iteration.id));
  const available = items
    .filter((item) => isInPool(item.iteration) && !memberIds.has(item.iteration.id))
    .filter((item) => item.pages !== null)
    .toSorted(byPriorityThenAge);
  const leaves = leafCategoriesOf(database.categories);
  const overall = overallIntention();
  const { shares } = distributionOf(overall);
  const shareOf = (categoryId: string) => effectiveShareOf(database.categories, shares, categoryId);
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
  const goal = new Map(leaves.map((leaf) => [leaf.id, (pages * (shareOf(leaf.id) ?? 0)) / 100]));
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

  // A share that cannot be filled goes to categories that still have supply, nearest first.
  let spreadCount = 0;
  const short = leaves.filter((leaf) => shortOf(leaf.id) > 0);
  for (const leaf of short.toSorted((first, second) => shortOf(second.id) - shortOf(first.id))) {
    let need = shortOf(leaf.id);
    const distanceOf = (item: ListItem) => {
      const category = database.categories.find(
        (candidate) => candidate.id === item.iteration.categoryId,
      );
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
      shapedBy: { intentionId: overall.id, name: overall.name },
      picks,
      requestedPages: pages,
      totalPages: total,
      spreadCount,
      shortfalls,
      provenance: {
        intentionId: overall.id,
        pages,
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
