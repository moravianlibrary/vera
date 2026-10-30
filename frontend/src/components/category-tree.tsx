// A category tree beside a pane (docs/demos/shared/page-categories.js `row`; STATUS "Categories"):
// a search, the Show picker, and the tree under *All categories*, every branch open to begin
// with. Categories shows it with counts and the selected mix; an intention's Mix with that mix only.
// Each row carries the number picked, remembered with the person's settings. A parent whose
// sibling set is under 100 keeps its ⚠ whatever is picked, so switching away from shares never
// hides it. Outside a scoped intention's subtree a mix number is neither shown nor read; the
// rows dim.

import type { CategoryNode, CategoryTotals } from "@vera/contract/categories";
import type { MixNode, MixTree } from "@vera/contract/mixes";
import type { CategoryTreeValue } from "@vera/domain/categories";
import { categoryTreeValues, isOutsideScope, searchedCategoriesOf } from "@vera/domain/categories";
import type { Category } from "@vera/domain/entities";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  categoryTreeValueLabels,
  isMixValue,
  mixNameOf,
  treeValueOf,
} from "@/components/category-tree-values";
import { Tree } from "@/components/tree";
import { Input } from "@/components/ui/input";
import { DriftMarker } from "@/components/visualizations/mix-bars";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";
import { i18n } from "@/i18n";
import { formatCount, formatPages, formatPercent } from "@/lib/format-number";

// What each category and the whole tree hold.
export interface CategoryCounts {
  totals: CategoryTotals;
  nodes: readonly CategoryNode[];
}

interface CategoryTreeProps {
  categories: readonly Category[];
  toolbar?: ReactNode;
  // A filtered Categories view supplies the matching nodes and their ancestors; Mix pages
  // retain this tree's own search.
  visibleIds?: ReadonlySet<string>;
  matchingIds?: ReadonlySet<string>;
  // None on a page that reads only a mix.
  counts: CategoryCounts | null;
  mix: MixTree | null;
  // What Show offers, in its order.
  offered: readonly CategoryTreeValue[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onVisibleRowsChange?: (rows: readonly Category[]) => void;
}

export function CategoryTree({
  categories,
  toolbar,
  visibleIds,
  matchingIds,
  counts,
  mix,
  offered,
  selectedId,
  onSelect,
  onVisibleRowsChange,
}: CategoryTreeProps) {
  const { t } = useTranslation("common");
  const id = useId();
  const { data: settings } = useUserSettingsQuery();
  const remember = useUserSettingsMutation();
  const [search, setSearch] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());
  const shown = treeValueOf(settings?.categoryTreeValue, offered);
  const searched = visibleIds ?? searchedCategoriesOf(categories, search);
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
  const isOutside = (categoryId: string | null) =>
    mix !== null && isOutsideScope(categories, mix.intention.scopeCategoryId, categoryId);
  const isDimmed = (categoryId: string | null) =>
    (isMixValue(shown) && isOutside(categoryId)) ||
    (categoryId !== null && matchingIds !== undefined && !matchingIds.has(categoryId));
  const warningOf = (unallocated: number, categoryId: string | null) =>
    mix === null || unallocated <= 0 || isOutside(categoryId)
      ? null
      : t("categoryTree.unallocatedWarning", {
          percent: formatPercent(unallocated),
          name: mixNameOf(mix),
        });
  const roots = childrenOf(null);
  const visibleRows: Category[] = [];
  const appendRows = (nodes: readonly Category[]) => {
    for (const node of nodes) {
      visibleRows.push(node);
      if (expandedIds.has(node.id)) appendRows(childrenOf(node.id));
    }
  };
  appendRows(roots);
  const visibleKey = visibleRows.map((category) => category.id).join("\u0000");
  const lastVisibleKey = useRef<string | null>(null);
  const notifyVisibleRows = useEffectEvent(() => {
    if (lastVisibleKey.current !== visibleKey) {
      lastVisibleKey.current = visibleKey;
      onVisibleRowsChange?.(visibleRows);
    }
  });
  useEffect(() => notifyVisibleRows());

  return (
    <div>
      <div className="sticky top-0 z-10 grid gap-2 border-b bg-background px-4 py-3">
        {toolbar}
        {visibleIds === undefined && (
          <Input
            type="search"
            aria-label={t("categoryTree.search")}
            placeholder={t("categoryTree.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-xs text-muted-foreground">
            {t("categoryTree.show")}
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
              .filter((value) => offered.includes(value))
              .map((value) => (
                <option key={value} value={value}>
                  {t(categoryTreeValueLabels[value])}
                </option>
              ))}
          </select>
        </div>
        {matchingIds !== undefined && matchingIds.size < categories.length && (
          <p className="text-xs text-muted-foreground">
            {t("categoryTree.matching", { count: matchingIds.size })}
          </p>
        )}
      </div>
      <Tree
        ariaLabel={t("categoryTree.categories")}
        roots={roots}
        childrenOf={(category) => childrenOf(category.id)}
        nodeId={(category) => category.id}
        label={(category) => category.name}
        value={(category) =>
          isDimmed(category.id) ? null : (
            <NodeValue
              shown={shown}
              node={counts?.nodes.find((node) => node.categoryId === category.id)}
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
          label: t("categoryTree.allCategories"),
          value: isDimmed(null) ? null : <RootValue shown={shown} totals={counts?.totals} />,
          warning: warningOf(mix?.unallocated ?? 0, null),
          isDimmed: isDimmed(null),
        }}
      />
      {searched?.size === 0 && (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {visibleIds === undefined
            ? t("categoryTree.noCategoryNamed")
            : t("categoryTree.noCategoriesMatch")}
        </p>
      )}
    </div>
  );
}

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;
const amber = (text: string) => <span className="text-tone-amber-foreground">{text}</span>;

function RootValue({ shown, totals }: { shown: CategoryTreeValue; totals?: CategoryTotals }) {
  switch (shown) {
    case "share":
    case "whole":
      return "100%";
    case "mix":
      return muted(i18n.t("categoryTree.intendedActual", { ns: "common" }));
    default:
      return totals === undefined ? null : countOf(shown, totals);
  }
}

interface NodeValueProps {
  shown: CategoryTreeValue;
  node: CategoryNode | undefined;
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
    return muted(i18n.t("categoryTree.scope", { ns: "common" }));
  }

  const { share, ofWhole, actual } = mixNode;
  switch (shown) {
    case "share":
      return share === null
        ? amber(i18n.t("mixSet.noShare", { ns: "common" }))
        : share === 0
          ? muted("0%")
          : `${share}%`;
    case "whole":
      return ofWhole === null ? amber("—") : formatPercent(ofWhole);
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
  totals: Pick<CategoryTotals, "documentCount" | "pages" | "readyPages">,
): ReactNode {
  switch (shown) {
    case "pages":
      return formatCount(totals.pages);
    case "ready":
      return totals.readyPages === 0 ? muted("—") : formatPages(totals.readyPages);
    default:
      return totals.documentCount;
  }
}
