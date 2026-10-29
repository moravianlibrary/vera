// The Categories page (docs/demos/shared/page-categories.js; STATUS "Categories"; concepts.md
// *Category*): the tree on the left and one category on the right, *All categories* when none is
// picked. It is about the tree, what each line of work holds and who holds custody of it; a
// category has no share of its own, so the selected mix is read-only here and links to its
// management view. Someone who cannot read mixes gets the tree, its numbers and custody, without
// a mix. The selection is `?c=` and pushes a history entry. On a phone the pane is a sheet, which
// *All categories* opens too. Watchlists and the shared filter bar narrow the tree while keeping
// ancestor paths; they leave the selected pane and the tree's Show preference intact. A change
// to the tree leaves a note in the pane it opens; Refine replaces it (`&refine=1`).
// TODO(rrandiak): labels move to i18n.

import { useQuery } from "@tanstack/react-query";
import {
  categoryFacets,
  matchingCategoryIds,
  visibleCategoryIds,
} from "@vera/contract/category-filters";
import { scopeOfCategory } from "@vera/domain/categories";
import { can } from "@vera/domain/permissions";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { listMixes } from "@/api/mix-catalog";
import { CategoryTree } from "@/components/category-tree";
import { countTreeValues } from "@/components/category-tree-values";
import { FilterBar } from "@/components/filters/filter-bar";
import { WatchlistTabs } from "@/components/filters/watchlist-tabs";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
import { MixPicker } from "@/components/mix-picker";
import { QueryState } from "@/components/query-state";
import {
  categoriesUrlStateOf,
  categoriesView,
  refineParam,
} from "@/features/categories/categories-view";
import { Breadcrumb, CategoryPane } from "@/features/categories/category-detail";
import type { CategoryNotice } from "@/features/categories/category-dialogs";
import { RefineWizard } from "@/features/categories/refine-wizard";
import { useCategoryIndexQuery } from "@/features/categories/use-categories-query";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useViewUrlState } from "@/hooks/use-view-url-state";

export function CategoriesPage() {
  const [params, setParams] = useSearchParams();
  const view = useViewUrlState(categoriesView, "c");
  const url = categoriesUrlStateOf(params);
  const { data: session } = useSessionQuery();
  const categoriesQuery = useCategoriesQuery();
  const categories = categoriesQuery.data;
  const indexQuery = useCategoryIndexQuery(view.query.mixId);
  const index = indexQuery.data;
  const categoriesFailure =
    categoriesQuery.isError || indexQuery.isError
      ? {
          text: "Could not load categories.",
          onRetry: () => {
            void categoriesQuery.refetch();
            void indexQuery.refetch();
          },
        }
      : undefined;
  const { data: mixes = [] } = useQuery({
    queryKey: ["mixes"],
    queryFn: listMixes,
    enabled: session !== undefined && can(session, "mix.read"),
  });
  const [isRootOpen, setIsRootOpen] = useState(false);
  const [notice, setNotice] = useState<CategoryNotice | null>(null);

  if (session === undefined) {
    return null;
  }

  if (categories === undefined || index === undefined) {
    return (
      <>
        <PageHeader title="Categories" />
        <QueryState
          isLoading={categoriesQuery.isLoading || indexQuery.isLoading}
          failure={categoriesFailure}
          loadingText="Loading categories…"
        >
          {null}
        </QueryState>
      </>
    );
  }

  const matches = matchingCategoryIds(categories, index, view.query);
  const visibleIds = visibleCategoryIds(categories, matches);
  const facets = categoryFacets(categories, index, view.query);
  const setCategoryParams = (id: string | null, replace = false) => {
    const next = new URLSearchParams(params);
    next.delete("c");
    next.delete(refineParam);
    if (id !== null) {
      next.set("c", id);
    }
    setParams(next, { replace });
  };

  // An unknown category opens the root, as no `c` does.
  const categoryId = categories.some((category) => category.id === url.categoryId)
    ? url.categoryId
    : null;
  const select = (id: string | null) => {
    setNotice(null);
    setIsRootOpen(id === null);
    setCategoryParams(id);
  };
  // The pane it leaves open says what was done; the root opens on a phone too, to say it.
  const showChanged = (id: string | null, changed: CategoryNotice) => {
    setIsRootOpen(id === null);
    setCategoryParams(id, true);
    setNotice(changed);
  };
  const category = categories.find((candidate) => candidate.id === categoryId) ?? null;
  const node = index.nodes.find((candidate) => candidate.categoryId === categoryId);
  const isRefining =
    url.isRefining &&
    category !== null &&
    node !== undefined &&
    node.documentCount > 0 &&
    !categories.some((candidate) => candidate.parentId === category.id) &&
    can(session, "category.edit", scopeOfCategory(categories, category.id));
  const name =
    categoryId === null
      ? "All categories"
      : (categories.find((category) => category.id === categoryId)?.name ?? "Category");
  const selectedMixId = view.query.mixId ?? mixes.find((mix) => mix.isPrimary)?.id;

  return (
    <>
      <PageHeader title="Categories" />
      {can(session, "watch") && (
        <WatchlistTabs
          view="categories"
          filter={view.filter}
          openedId={view.watchlistId}
          canShare={can(session, "watchlist.manage_system")}
          onOpen={view.openWatchlist}
          onDetach={view.detachWatchlist}
          isBare={view.isBare}
        />
      )}
      <FilterBar
        key={view.filterReplacements}
        fields={categoriesView.fields.filter(
          (field) =>
            index.mix !== null ||
            field.key !== "attentions" ||
            (view.query.attentions?.length ?? 0) > 0,
        )}
        query={view.query}
        facets={facets}
        onQueryChange={view.setQuery}
        searchLabel="Search categories"
        searchPlaceholder="Search categories — name, ID"
      />
      <MasterDetail
        masterWidth="tree"
        master={
          <QueryState
            isLoading={false}
            failure={categoriesFailure}
            loadingText="Loading categories…"
          >
            <CategoryTree
              categories={categories}
              toolbar={
                index.mix !== null ? (
                  <MixPicker
                    id="categories-mix"
                    mixes={mixes}
                    value={selectedMixId ?? ""}
                    onValueChange={(value) => view.setQuery({ ...view.query, mixId: value })}
                  />
                ) : undefined
              }
              visibleIds={visibleIds}
              matchingIds={matches}
              counts={index}
              mix={index.mix}
              offered={
                index.mix === null ? countTreeValues : ["share", "whole", ...countTreeValues]
              }
              selectedId={categoryId}
              onSelect={select}
            />
          </QueryState>
        }
        detail={
          isRefining ? (
            <RefineWizard
              key={categoryId}
              categories={categories}
              category={category}
              node={node}
              breadcrumb={
                <Breadcrumb categories={categories} category={category} onSelect={select} />
              }
              onCancel={() => setCategoryParams(category.id, true)}
              onRefined={(child, refined) => showChanged(child.id, refined)}
            />
          ) : (
            <CategoryPane
              key={categoryId ?? ""}
              categories={categories}
              index={index}
              categoryId={categoryId}
              session={session}
              notice={notice}
              onSelect={select}
              onChanged={showChanged}
              onRefine={() => {
                setNotice(null);
                const next = new URLSearchParams(params);
                next.set("c", category?.id ?? "");
                next.set(refineParam, "1");
                setParams(next);
              }}
            />
          )
        }
        detailTitle={name}
        detailOpen={categoryId !== null || isRootOpen}
        onDetailOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsRootOpen(false);
            setCategoryParams(null);
          }
        }}
      />
    </>
  );
}
