// What the server does with an intention's mix: read the mix it chose over the tree against the
// intention's output (PLAN-mix-reading). A scoped intention reads only its subtree: shares outside
// it, the scope's own included, are not sent, and inside it each is of the scope, not of the
// whole (PLAN-mix-within-scope). The mix itself is edited on Mixes (ACT-mix-save).

import type { IntentionMixDetail, MixTree } from "@vera/contract/mixes";
import { isInSubtree } from "@vera/domain/categories";
import type { Intention, Session } from "@vera/domain/entities";
import { countIntention, shareWithinOf } from "@vera/domain/intentions";
import { siblingSetOf } from "@vera/domain/mixes";
import { database } from "@/mocks/database";
import { countingData, distributionOf, isVisible } from "@/mocks/intentions";

// What a set the scope does not use reads as: nothing to flag.
const noSet = { unallocated: 0, noShareIds: [] };

export function mixTreeOf(intention: Intention, includeOutput = true): MixTree {
  const { categories } = database;
  const selectedMix = distributionOf(intention);
  const { shares } = selectedMix;
  const scope = intention.scopeCategoryId;
  const isInScope = (categoryId: string) =>
    scope === null || isInSubtree(categories, categoryId, scope);
  const isBelowScope = (categoryId: string) => isInScope(categoryId) && categoryId !== scope;
  const data = countingData();
  const counted = includeOutput ? countIntention(intention, data) : null;
  const output = counted?.output ?? [];
  const outputPages = counted?.outputPages ?? 0;
  const outputUnder = (categoryId: string) =>
    output
      .filter((iteration) => isInSubtree(categories, iteration.categoryId, categoryId))
      .reduce((sum, iteration) => sum + (data.pagesOf(iteration) ?? 0), 0);
  return {
    mixId: selectedMix.id,
    mixName: selectedMix.name,
    intention,
    outputPages,
    ...(scope === null ? siblingSetOf(categories, shares, null) : noSet),
    nodes: categories.map((category) => ({
      categoryId: category.id,
      share: isBelowScope(category.id) ? (shares[category.id] ?? null) : null,
      ofWhole: isInScope(category.id)
        ? shareWithinOf(categories, { shares }, scope, category.id)
        : null,
      actual:
        isInScope(category.id) && outputPages > 0
          ? (outputUnder(category.id) / outputPages) * 100
          : null,
      ...(isInScope(category.id) ? siblingSetOf(categories, shares, category.id) : noSet),
    })),
  };
}

function detailOf(intention: Intention): IntentionMixDetail {
  return {
    mix:
      intention.archived === null
        ? mixTreeOf(intention)
        : (database.archivedIntentionMixes[intention.id] ?? mixTreeOf(intention)),
    archivedCategories:
      intention.archived === null
        ? null
        : (database.archivedIntentionCategories[intention.id] ?? database.categories),
    revision: distributionOf(intention).revision,
  };
}

export function findIntentionMix(session: Session, intentionId: string): IntentionMixDetail | null {
  const intention = database.intentions.find((candidate) => candidate.id === intentionId);
  return intention === undefined ||
    intention.distributionId === null ||
    !isVisible(session, intention)
    ? null
    : detailOf(intention);
}
