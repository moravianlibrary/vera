// Categories filter over the tree's full read model. A match counts the category itself;
// ancestors appear only as context so a filtered tree keeps its paths intact.

import { categoryLineageOf, isOutsideScope } from "@vera/domain/categories";
import type { Category } from "@vera/domain/entities";
import { isWithinRange } from "@vera/domain/value-range";
import type { CategoryIndex, CategoryQuery } from "./categories";
import { categoryAttentions, categoryCustodies, categoryKinds } from "./categories";

export function matchingCategoryIds(
  categories: readonly Category[],
  index: CategoryIndex,
  query: CategoryQuery,
): ReadonlySet<string> {
  const term = query.search?.trim().toLocaleLowerCase();
  const matches = categories.filter((category) => {
    if (
      term &&
      !Object.values(category.names).some((name) => name?.toLocaleLowerCase().includes(term)) &&
      !category.id.toLocaleLowerCase().includes(term)
    ) {
      return false;
    }

    const node = index.nodes.find((candidate) => candidate.categoryId === category.id);
    const mixNode = index.mix?.nodes.find((candidate) => candidate.categoryId === category.id);
    const isLeaf = !categories.some((child) => child.parentId === category.id);
    const kinds = [isLeaf ? "Leaf" : "Branch"];
    const custodies = [
      ...(node?.reach.length === 0 ? ["Unheld"] : []),
      ...(node?.grants.length ? ["Direct"] : []),
      ...(node?.reach.some((reach) => reach.grantedOn.id !== category.id) ? ["Inherited"] : []),
    ];
    const isInsideMix =
      index.mix !== null &&
      !isOutsideScope(categories, index.mix.intention.scopeCategoryId, category.id);
    const attentions = [
      ...(mixNode !== undefined && mixNode.unallocated > 0 ? ["Unallocated"] : []),
      ...(isInsideMix &&
      category.id !== index.mix?.intention.scopeCategoryId &&
      mixNode?.share === null
        ? ["NoShare"]
        : []),
    ];
    const anyOf = (selected: readonly string[] | undefined, values: readonly string[]) =>
      selected === undefined ||
      selected.length === 0 ||
      selected.some((value) => values.includes(value));

    return (
      anyOf(query.kinds, kinds) &&
      anyOf(query.custodies, custodies) &&
      anyOf(query.attentions, attentions) &&
      (query.documents === undefined ||
        (node !== undefined && isWithinRange(node.documentCount, query.documents))) &&
      (query.readyPages === undefined ||
        (node !== undefined && isWithinRange(node.readyPages, query.readyPages)))
    );
  });
  return new Set(matches.map((category) => category.id));
}

export function visibleCategoryIds(
  categories: readonly Category[],
  matches: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set(
    categories
      .filter((category) => matches.has(category.id))
      .flatMap((category) => categoryLineageOf(categories, category.id)),
  );
}

export function categoryFacets(
  categories: readonly Category[],
  index: CategoryIndex,
  query: CategoryQuery,
) {
  const values = {
    kinds: categoryKinds,
    custodies: categoryCustodies,
    attentions: index.mix === null ? [] : categoryAttentions,
  } as const;
  return Object.fromEntries(
    (Object.keys(values) as (keyof typeof values)[]).map((field) => {
      const counts = values[field].map((value) => ({
        value,
        count: matchingCategoryIds(categories, index, { ...query, [field]: [value] }).size,
      }));
      return [field, counts];
    }),
  );
}
