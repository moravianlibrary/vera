// Resource-oriented answers for Users management. An assignment keeps its source even when
// several assignments reach the same person. The tables count people once, details show every
// route into the proposal, category, or project.

import type { AccessIndex, AccessProposal } from "@/api/access";
import { custodyMembersOf } from "@/domain/access";
import type { Category } from "@/domain/entities";

export interface CustodySource {
  userId: string;
  viaGroupId: string | null;
  // For proposals: the named set that contains the proposal.
  custodyId?: string;
  // For categories: this node or an ancestor on which custody was assigned.
  grantedOnId?: string;
}

export function categoryPathIds(categories: readonly Category[], categoryId: string): string[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const path: string[] = [];
  const seen = new Set<string>();
  for (let id: string | null = categoryId; id !== null && !seen.has(id); ) {
    const category = byId.get(id);
    if (category === undefined) break;
    path.unshift(id);
    seen.add(id);
    id = category.parentId;
  }
  return path;
}

export function categoryPath(index: AccessIndex, categoryId: string): string {
  const byId = new Map(index.categories.map((category) => [category.id, category.name]));
  return categoryPathIds(index.categories, categoryId)
    .map((id) => byId.get(id) ?? id)
    .join(" / ");
}

export function categorySourcesOf(index: AccessIndex, categoryId: string): CustodySource[] {
  return categoryPathIds(index.categories, categoryId).flatMap((grantedOnId) => [
    ...(
      index.categoryMemberships.find((membership) => membership.categoryId === grantedOnId)
        ?.userIds ?? []
    ).map((userId) => ({ userId, viaGroupId: null, grantedOnId })),
    ...index.groups
      .filter((group) => group.categoryIds.includes(grantedOnId))
      .flatMap((group) =>
        group.memberIds.map((userId) => ({ userId, viaGroupId: group.id, grantedOnId })),
      ),
  ]);
}

export function proposalSourcesOf(index: AccessIndex, proposal: AccessProposal): CustodySource[] {
  return proposal.custodyIds.flatMap((custodyId) => {
    const custody = index.custodies.find((candidate) => candidate.id === custodyId);
    return custody === undefined
      ? []
      : custodyMembersOf(custody, index.groups).flatMap(({ userId, via }) =>
          via.map((viaGroupId) => ({ userId, viaGroupId, custodyId })),
        );
  });
}

export function uniquePeople(sources: readonly CustodySource[]): string[] {
  return [...new Set(sources.map((source) => source.userId))];
}
