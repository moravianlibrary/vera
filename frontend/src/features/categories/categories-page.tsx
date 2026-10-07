// The Categories page (docs/demos/shared/page-categories.js; STATUS "Categories"; concepts.md
// *Category*): the tree on the left and one category on the right, *All categories* when none is
// picked. It is about the tree, what each line of work holds and who holds custody of it; a
// category has no share of its own, so the only mix here is Overall's, read-only, linking to
// where it is edited (intentions.md §2.4, decided 2026-10-07; the demo still picks an intention
// with `?i=`). Someone who cannot read intentions gets the tree, its numbers and custody, without
// a mix. The selection is `?c=` and pushes a history entry. On a phone the pane is a sheet, which
// *All categories* opens too.
// TODO(rrandiak): labels move to i18n.

import { useState } from "react";
import { useSearchParams } from "react-router";
import { CategoryTree } from "@/components/category-tree";
import { countTreeValues, mixTreeValues } from "@/components/category-tree-values";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
import { categoriesUrlStateOf } from "@/features/categories/categories-view";
import { CategoryPane } from "@/features/categories/category-detail";
import { useCategoryIndexQuery } from "@/features/categories/use-categories-query";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";

export function CategoriesPage() {
  const [params, setParams] = useSearchParams();
  const url = categoriesUrlStateOf(params);
  const { data: session } = useSessionQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: index } = useCategoryIndexQuery();
  const [isRootOpen, setIsRootOpen] = useState(false);

  if (session === undefined || categories === undefined || index === undefined) {
    return <PageHeader title="Categories" />;
  }

  // An unknown category opens the root, as no `c` does.
  const categoryId = categories.some((category) => category.id === url.categoryId)
    ? url.categoryId
    : null;
  const select = (id: string | null) => {
    setIsRootOpen(id === null);
    setParams(id === null ? {} : { c: id });
  };
  const name =
    categoryId === null
      ? "All categories"
      : (categories.find((category) => category.id === categoryId)?.name ?? "Category");

  return (
    <>
      <PageHeader title="Categories" />
      <MasterDetail
        masterWidth="tree"
        master={
          <CategoryTree
            categories={categories}
            counts={index}
            mix={index.mix}
            offered={index.mix === null ? countTreeValues : [...mixTreeValues, ...countTreeValues]}
            selectedId={categoryId}
            onSelect={select}
          />
        }
        detail={
          <CategoryPane
            key={categoryId ?? ""}
            categories={categories}
            index={index}
            categoryId={categoryId}
            session={session}
            onSelect={select}
          />
        }
        detailTitle={name}
        detailOpen={categoryId !== null || isRootOpen}
        onDetailOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsRootOpen(false);
            setParams({});
          }
        }}
      />
    </>
  );
}
