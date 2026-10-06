// The Categories tree (docs/demos/shared/page-categories.js `row`; STATUS "Categories"): a search,
// the Show picker, and the tree under *All categories*, every branch open to begin with. Each row
// carries the number picked, remembered with the person's settings. A parent whose sibling set
// is under 100 keeps its ⚠ whatever is picked, so switching away from shares never hides it.
// Outside a scoped intention's subtree a mix number is neither shown nor read; the rows dim.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useId, useState } from "react";
import type { CategoryIndex, MixNode } from "@/api/categories";
import { Tree } from "@/components/tree";
import { Input } from "@/components/ui/input";
import { DriftMarker } from "@/components/visualizations/mix-bars";
import type { CategoryTreeValue } from "@/domain/categories";
import { categoryTreeValues } from "@/domain/categories";
import type { Category } from "@/domain/entities";
import {
  categoryTreeValueLabels,
  isMixValue,
  isOutOfScope,
  mixNameOf,
  percentTextOf,
  searchedCategoriesOf,
  treeValueOf,
} from "@/features/categories/categories-view";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";
import { formatCount } from "@/lib/format-number";

interface CategoryTreeProps {
  categories: readonly Category[];
  index: CategoryIndex;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryTree({ categories, index, selectedId, onSelect }: CategoryTreeProps) {
  const id = useId();
  const { data: settings } = useUserSettingsQuery();
  const remember = useUserSettingsMutation();
  const [search, setSearch] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());
  const { mix } = index;
  const shown = treeValueOf(settings?.categoryTreeValue, mix !== null);
  const searched = searchedCategoriesOf(categories, search);
  const isShown = (category: Category) => searched === null || searched.has(category.id);
  const childrenOf = (parentId: string | null) =>
    categories.filter((category) => category.parentId === parentId && isShown(category));
  const branchIds = categories
    .filter((category) => categories.some((child) => child.parentId === category.id))
    .map((category) => category.id);
  // A search opens every branch it keeps.
  const expandedIds = new Set(
    searched === null ? branchIds.filter((branchId) => !collapsedIds.has(branchId)) : branchIds,
  );
  const mixNodeOf = (categoryId: string) =>
    mix?.nodes.find((node) => node.categoryId === categoryId);
  const isDimmed = (categoryId: string | null) =>
    mix !== null && isMixValue(shown) && isOutOfScope(categories, mix, categoryId);
  const warningOf = (unallocated: number, categoryId: string | null) =>
    mix === null || unallocated <= 0 || isOutOfScope(categories, mix, categoryId)
      ? null
      : `${percentTextOf(unallocated)} of its share is unallocated in ${mixNameOf(mix)}`;
  const roots = childrenOf(null);

  return (
    <div>
      <div className="sticky top-0 z-10 grid gap-2 border-b bg-background px-4 py-3">
        <Input
          type="search"
          aria-label="Search categories"
          placeholder="Search categories…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-xs text-muted-foreground">
            Show
          </label>
          <select
            id={id}
            className="h-7 rounded-md border bg-background px-2 text-xs"
            value={shown}
            onChange={(event) => {
              const value = categoryTreeValues.find(
                (candidate) => candidate === event.target.value,
              );
              if (value !== undefined) {
                remember.mutate({ categoryTreeValue: value });
              }
            }}
          >
            {categoryTreeValues
              .filter((value) => mix !== null || !isMixValue(value))
              .map((value) => (
                <option key={value} value={value}>
                  {categoryTreeValueLabels[value]}
                </option>
              ))}
          </select>
        </div>
      </div>
      <Tree
        ariaLabel="Categories"
        roots={roots}
        childrenOf={(category) => childrenOf(category.id)}
        nodeId={(category) => category.id}
        label={(category) => category.name}
        value={(category) =>
          isDimmed(category.id) ? null : (
            <NodeValue
              shown={shown}
              node={index.nodes.find((node) => node.categoryId === category.id)}
              mixNode={mixNodeOf(category.id)}
              isScope={mix?.intention.scopeCategoryId === category.id}
            />
          )
        }
        warning={(category) => warningOf(mixNodeOf(category.id)?.unallocated ?? 0, category.id)}
        isDimmed={(category) => isDimmed(category.id)}
        selectedId={selectedId}
        onSelect={onSelect}
        expandedIds={expandedIds}
        onExpandedChange={(expanded) =>
          setCollapsedIds(new Set(branchIds.filter((branchId) => !expanded.has(branchId))))
        }
        virtualRoot={{
          label: "All categories",
          value: isDimmed(null) ? null : <RootValue shown={shown} index={index} />,
          warning: warningOf(mix?.unallocated ?? 0, null),
          isDimmed: isDimmed(null),
        }}
      />
      {searched?.size === 0 && (
        <p className="px-4 py-6 text-sm text-muted-foreground">No category is called that.</p>
      )}
    </div>
  );
}

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;
const amber = (text: string) => <span className="text-tone-amber-foreground">{text}</span>;

function RootValue({ shown, index }: { shown: CategoryTreeValue; index: CategoryIndex }) {
  const { totals } = index;
  switch (shown) {
    case "share":
    case "whole":
      return "100%";
    case "mix":
      return muted("intended → actual");
    default:
      return countOf(shown, totals);
  }
}

interface NodeValueProps {
  shown: CategoryTreeValue;
  node: CategoryIndex["nodes"][number] | undefined;
  mixNode: MixNode | undefined;
  isScope: boolean;
}

function NodeValue({ shown, node, mixNode, isScope }: NodeValueProps): ReactNode {
  if (!isMixValue(shown)) {
    return node === undefined ? null : countOf(shown, node);
  }

  if (mixNode === undefined) {
    return null;
  }

  if (isScope) {
    return muted("the scope · 100%");
  }

  const { share, ofWhole, actual } = mixNode;
  switch (shown) {
    case "share":
      return share === null ? amber("no share") : share === 0 ? muted("0%") : `${share}%`;
    case "whole":
      return ofWhole === null ? amber("—") : percentTextOf(ofWhole);
    default:
      return (
        <>
          {ofWhole === null ? "—" : `${Math.round(ofWhole)}%`} →{" "}
          {actual === null ? "—" : `${Math.round(actual)}%`}
          <DriftMarker intended={ofWhole} actual={actual} />
        </>
      );
  }
}

function countOf(
  shown: CategoryTreeValue,
  totals: Pick<CategoryIndex["totals"], "documentCount" | "pages" | "readyPages">,
): ReactNode {
  switch (shown) {
    case "pages":
      return formatCount(totals.pages);
    case "ready":
      return totals.readyPages === 0 ? muted("—") : `${formatCount(totals.readyPages)} pp`;
    default:
      return totals.documentCount;
  }
}
