// What the server does for Categories (concepts.md *Category*; intentions.md §2.4; STATUS
// "Categories"): total each category's subtree, resolve who holds custody of it and whom that
// reaches, and read Overall's mix over the tree for whoever may read intentions. No other mix:
// one is read and edited on its intention (`mocks/mixes.ts`).

import type { CategoryIndex, CategoryNode, CategoryTotals, CustodyGrant } from "@/api/categories";
import type { CustodyHolders } from "@/domain/categories";
import { custodyReachOf, isInSubtree, unheldCategoriesOf } from "@/domain/categories";
import type { Iteration, Session } from "@/domain/entities";
import { isInPool, isScanned } from "@/domain/lists";
import { can } from "@/domain/permissions";
import { database } from "@/mocks/database";
import { categoryMembers, groups } from "@/mocks/fixtures/access";
import { countingData, overallIntention } from "@/mocks/intentions";
import { mixTreeOf } from "@/mocks/mixes";

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

export function queryCategoryIndex(session: Session): CategoryIndex {
  const { categories, iterations } = database;
  return {
    totals: totalsOf(iterations),
    nodes: categories.map((category) => nodeOf(category.id)),
    mix: can(session, "intention.read") ? mixTreeOf(overallIntention()) : null,
    unheldIds: unheldCategoriesOf(categories, holders()).map((category) => category.id),
  };
}
