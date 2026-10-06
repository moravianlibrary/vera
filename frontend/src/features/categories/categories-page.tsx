// The Categories page (docs/demos/shared/page-categories.js; STATUS "Categories"; intentions.md
// §2.4): the tree on the left and one category on the right, *All categories* when none is
// picked. *Mix of* in the header picks the intention whose mix the page reads (`?i=`), the owners
// first, each with what tracks it, then the trackers, which read their owner's. Someone who
// cannot read intentions gets the tree, its numbers and custody, without a mix. The selection is
// `?c=` and pushes a history entry; a picked intention replaces it. On a phone the pane is a sheet,
// which *All categories* opens too.
// TODO(rrandiak): labels move to i18n.

import { useId, useState } from "react";
import { useSearchParams } from "react-router";
import type { CategoryIndex, MixPick } from "@/api/categories";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoriesUrlStateOf } from "@/features/categories/categories-view";
import { CategoryPane } from "@/features/categories/category-detail";
import { CategoryTree } from "@/features/categories/category-tree";
import { useCategoryIndexQuery } from "@/features/categories/use-categories-query";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";

export function CategoriesPage() {
  const [params, setParams] = useSearchParams();
  const url = categoriesUrlStateOf(params);
  const { data: session } = useSessionQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: index } = useCategoryIndexQuery(url.intentionId);
  const [isRootOpen, setIsRootOpen] = useState(false);

  if (session === undefined || categories === undefined || index === undefined) {
    return <PageHeader title="Categories" />;
  }

  // An unknown category opens the root, as no `c` does.
  const categoryId = categories.some((category) => category.id === url.categoryId)
    ? url.categoryId
    : null;
  const mixId = index.mix?.intention.id ?? null;
  const write = (next: { categoryId: string | null; intentionId: string | null }) => {
    const query = new URLSearchParams();
    if (next.intentionId !== null && next.intentionId !== overallIdOf(index)) {
      query.set("i", next.intentionId);
    }

    if (next.categoryId !== null) {
      query.set("c", next.categoryId);
    }

    return query;
  };
  const select = (id: string | null) => {
    setIsRootOpen(id === null);
    setParams(write({ categoryId: id, intentionId: mixId }));
  };
  const pickIntention = (intentionId: string, atCategoryId: string | null = categoryId) =>
    setParams(write({ categoryId: atCategoryId, intentionId }), { replace: true });
  const name =
    categoryId === null
      ? "All categories"
      : (categories.find((category) => category.id === categoryId)?.name ?? "Category");

  return (
    <>
      <PageHeader
        title="Categories"
        control={
          index.mix === null ? undefined : (
            <MixPicker picks={index.picks} value={index.mix.intention.id} onPick={pickIntention} />
          )
        }
      />
      <MasterDetail
        masterWidth="tree"
        master={
          <CategoryTree
            categories={categories}
            index={index}
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
            onPickIntention={pickIntention}
          />
        }
        detailTitle={name}
        detailOpen={categoryId !== null || isRootOpen}
        onDetailOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsRootOpen(false);
            setParams(write({ categoryId: null, intentionId: mixId }));
          }
        }}
      />
    </>
  );
}

function overallIdOf(index: CategoryIndex): string | null {
  return index.picks.find((pick) => pick.isOverall)?.id ?? null;
}

// "House mix · Overall · tracked by 7", "NDK Periodika — 2026 Q3 → Periodicals push — watch".
function pickLabelOf(pick: MixPick): string {
  if (pick.tracks !== null) {
    return `${pick.name} → ${pick.tracks.name}`;
  }

  return [
    pick.name,
    pick.isOverall ? "Overall" : null,
    pick.trackerCount > 0 ? `tracked by ${pick.trackerCount}` : "own",
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

interface MixPickerProps {
  picks: readonly MixPick[];
  value: string;
  onPick: (intentionId: string) => void;
}

function MixPicker({ picks, value, onPick }: MixPickerProps) {
  const id = useId();
  const owners = picks.filter((pick) => pick.tracks === null);
  const trackers = picks.filter((pick) => pick.tracks !== null);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-xs text-muted-foreground">
        Mix of
      </label>
      <Select value={value} onValueChange={onPick}>
        <SelectTrigger id={id} size="sm" className="min-w-0 flex-1 md:w-[26rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Own a mix</SelectLabel>
            {owners.map((pick) => (
              <SelectItem key={pick.id} value={pick.id}>
                {pickLabelOf(pick)}
              </SelectItem>
            ))}
          </SelectGroup>
          {trackers.length > 0 && (
            <SelectGroup>
              <SelectLabel>Track another</SelectLabel>
              {trackers.map((pick) => (
                <SelectItem key={pick.id} value={pick.id}>
                  {pickLabelOf(pick)}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
