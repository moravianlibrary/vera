// What the server does for Categories (intentions.md §1, §2.4; STATUS "Categories"): total each
// category's subtree, resolve who holds custody of it and whom that reaches, and read one
// intention's mix over the tree. `?i=` picks the intention; none, or one the caller cannot see,
// is Overall, if they can see that. A tracker reads its owner's mix. A scoped intention reads only
// its subtree: shares outside it, the scope's own included, are not sent, and inside it each is
// of the scope, not of the whole (§3.2). Actual is a category's part of the intention's own output, in its scope and window.

import type {
  CategoryIndex,
  CategoryMix,
  CategoryNode,
  CategoryTotals,
  CustodyGrant,
  MixPick,
  UnallocatedSet,
} from "@/api/categories";
import type { CustodyHolders } from "@/domain/categories";
import { custodyReachOf, isInSubtree, unheldCategoriesOf } from "@/domain/categories";
import type { Intention, Iteration, Session } from "@/domain/entities";
import {
  countIntention,
  mixOwnerOf,
  scopeOfIntention,
  shareWithinOf,
  trackersOf,
} from "@/domain/intentions";
import { isInPool, isScanned } from "@/domain/lists";
import { siblingSetOf } from "@/domain/mixes";
import { can } from "@/domain/permissions";
import { database } from "@/mocks/database";
import { categoryMembers, groups } from "@/mocks/fixtures/access";
import { countingData, distributionOf, overallIntention } from "@/mocks/intentions";

export function canReadCategories(session: Session): boolean {
  return can(session, "category.read");
}

const holders = (): CustodyHolders => ({ groups, members: categoryMembers });

const nameOfUser = (userId: string) =>
  database.users.find((user) => user.id === userId)?.name ?? userId;
const nameOfCategory = (categoryId: string) =>
  database.categories.find((category) => category.id === categoryId)?.name ?? categoryId;

function totalsOf(iterations: readonly Iteration[]): CategoryTotals {
  const { pagesOf } = countingData();
  const pagesIn = (of: readonly Iteration[]) =>
    of.reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0);
  return {
    documentCount: iterations.length,
    pages: pagesIn(iterations),
    deliveredPages: pagesIn(iterations.filter(isScanned)),
    readyPages: pagesIn(iterations.filter(isInPool)),
  };
}

function nodeOf(categoryId: string): CategoryNode {
  const { categories, iterations } = database;
  const custody = holders();
  const grants: CustodyGrant[] = [
    ...custody.groups
      .filter((group) => group.categoryIds.includes(categoryId))
      .map((group): CustodyGrant => ({ kind: "group", id: group.id, name: group.name })),
    ...(custody.members[categoryId] ?? []).map(
      (userId): CustodyGrant => ({ kind: "person", id: userId, name: nameOfUser(userId) }),
    ),
  ];
  return {
    categoryId,
    ...totalsOf(
      iterations.filter((iteration) => isInSubtree(categories, iteration.categoryId, categoryId)),
    ),
    grants,
    reach: custodyReachOf(categories, custody, categoryId).map((reach) => {
      const group = custody.groups.find((candidate) => candidate.id === reach.groupId);
      return {
        userId: reach.userId,
        name: nameOfUser(reach.userId),
        group: group === undefined ? null : { id: group.id, name: group.name },
        grantedOn: { id: reach.categoryId, name: nameOfCategory(reach.categoryId) },
      };
    }),
  };
}

// What a set the scope does not use reads as: nothing to flag.
const noSet = { unallocated: 0, noShareIds: [] };

const isVisible = (session: Session, intention: Intention) =>
  can(session, "intention.read", scopeOfIntention(intention, database.projects));

function mixOf(intention: Intention): CategoryMix {
  const { categories, intentions } = database;
  const owner = mixOwnerOf(intention, intentions);
  const { shares } = distributionOf(owner);
  const scope = intention.scopeCategoryId;
  const isInScope = (categoryId: string) =>
    scope === null || isInSubtree(categories, categoryId, scope);
  const isBelowScope = (categoryId: string) => isInScope(categoryId) && categoryId !== scope;
  const data = countingData();
  const { output, outputPages } = countIntention(intention, data);
  const outputUnder = (categoryId: string) =>
    output
      .filter((iteration) => isInSubtree(categories, iteration.categoryId, categoryId))
      .reduce((sum, iteration) => sum + (data.pagesOf(iteration) ?? 0), 0);
  return {
    intention,
    owner,
    trackers: trackersOf(owner, intentions).map(({ id, name }) => ({ id, name })),
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

function picksOf(session: Session, picked: Intention | null): MixPick[] {
  const { intentions } = database;
  return intentions
    .filter(
      (intention) =>
        isVisible(session, intention) && (intention.archived === null || intention === picked),
    )
    .map((intention) => {
      const owner = mixOwnerOf(intention, intentions);
      return {
        id: intention.id,
        name: intention.name,
        isOverall: intention.isOverall,
        tracks: owner === intention ? null : { id: owner.id, name: owner.name },
        trackerCount: trackersOf(intention, intentions).length,
      };
    });
}

// Every set under 100 in each mix the caller can see the owner of, the top level first; a scoped
// owner's only inside its scope, the rest being unused.
function unallocatedSetsOf(session: Session): UnallocatedSet[] {
  const { categories, intentions } = database;
  const owners = intentions.filter(
    (intention) =>
      intention.tracksMixOf === null &&
      intention.archived === null &&
      isVisible(session, intention),
  );
  return owners.flatMap((owner) => {
    const { shares } = distributionOf(owner);
    const scope = owner.scopeCategoryId;
    const parentIds =
      scope === null
        ? [null, ...categories.map((category) => category.id)]
        : categories
            .filter((category) => isInSubtree(categories, category.id, scope))
            .map((category) => category.id);
    return parentIds.flatMap((categoryId) => {
      const set = siblingSetOf(categories, shares, categoryId);
      return set.unallocated > 0
        ? [{ categoryId, owner: { id: owner.id, name: owner.name }, ...set }]
        : [];
    });
  });
}

export function queryCategoryIndex(session: Session, intentionId: string | null): CategoryIndex {
  const { categories, iterations } = database;
  const canReadMix = can(session, "intention.read");
  const visible = (intention: Intention | undefined) =>
    intention !== undefined && isVisible(session, intention) ? intention : null;
  const picked = canReadMix
    ? (visible(database.intentions.find((intention) => intention.id === intentionId)) ??
      visible(overallIntention()))
    : null;
  return {
    totals: totalsOf(iterations),
    nodes: categories.map((category) => nodeOf(category.id)),
    mix: picked === null ? null : mixOf(picked),
    picks: canReadMix ? picksOf(session, picked) : [],
    attention: {
      sets: canReadMix ? unallocatedSetsOf(session) : [],
      unheldIds: unheldCategoriesOf(categories, holders()).map((category) => category.id),
    },
  };
}
