// Shape: Record page.
// An intention's Mix, `/intentions/:intentionId/mix` (intentions.md §2.3–§2.5; concepts.md *Mix*,
// decided 2026-10-07; docs/demos/shared/page-categories.js for the tree and the set editor, which
// the demo still keeps on Categories). The category tree with the intention's shares, read
// against its own output, and one category in the pane, *All categories* when none is picked.
// Read-only: the mix is its own record, edited on Mixes (PLAN-mix, ACT-mix-save), which the header
// links to. A scoped intention shows its subtree, the rest dimmed and unused.
// `?c=` is the category open, pushing a history entry. On a phone the pane is a sheet.
import type { MixTree } from "@vera/contract/mixes";
import { categoryPathOf, isOutsideScope } from "@vera/domain/categories";
import type { Category } from "@vera/domain/entities";
import { can } from "@vera/domain/permissions";
import { Fragment, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import type { ViewAction } from "@/components/actions/action-bar";
import { CategoryTree } from "@/components/category-tree";
import { mixNameOf, mixTreeValues } from "@/components/category-tree-values";
import type { Stat } from "@/components/detail-card";
import { DetailCard, DetailRow, FinePrint, Muted, StatTiles } from "@/components/detail-card";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { MixSetCard } from "@/components/mix-set-card";
import { failureOf, QueryState } from "@/components/query-state";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { useIntentionMixQuery } from "@/features/intentions/use-intentions-query";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useTier } from "@/hooks/use-tier";
import { i18n } from "@/i18n";
import { formatPercent } from "@/lib/format-number";

const message = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, {
    ns:
      key.startsWith("categoriesPage.") || key.startsWith("categoryPane.")
        ? "categories"
        : "intentions",
    ...options,
  });

export function IntentionMixPage() {
  const { intentionId = null } = useParams();
  const [params, setParams] = useSearchParams();
  const detailQuery = useIntentionMixQuery(intentionId);
  const { data: detail } = detailQuery;
  const { data: liveCategories } = useCategoriesQuery();
  const { data: session } = useSessionQuery();
  const [isRootOpen, setIsRootOpen] = useState(false);
  const [swipeRows, setSwipeRows] = useState<readonly Category[]>([]);
  // A phone's header has no room for the action beside the title.
  const isInMenu = useTier() === "phone";
  const backToIndex = {
    label: message("intentionsPage.title"),
    href: intentionId === null ? "/intentions" : `/intentions?i=${encodeURIComponent(intentionId)}`,
  };

  if (detail === null) {
    return (
      <>
        <PageHeader title={message("mixPage.title")} breadcrumb={backToIndex} />
        <PageContent>
          <p className="text-sm text-muted-foreground">{message("mixPage.notVisible")}</p>
        </PageContent>
      </>
    );
  }

  if (detailQuery.isError) {
    return (
      <>
        <PageHeader title={message("mixPage.title")} breadcrumb={backToIndex} />
        <QueryState
          isLoading={false}
          failure={failureOf(detailQuery, message("mixPage.loadError"))}
        >
          <span />
        </QueryState>
      </>
    );
  }

  if (detail === undefined || liveCategories === undefined || session === undefined) {
    return (
      <>
        <PageHeader title={message("mixPage.title")} breadcrumb={backToIndex} />
        <QueryState
          isLoading={detailQuery.isLoading}
          failure={failureOf(detailQuery, message("mixPage.loadError"))}
          loadingText={message("mixPage.loading")}
        >
          <span />
        </QueryState>
      </>
    );
  }

  const { mix } = detail;
  const categories = detail.archivedCategories ?? liveCategories;
  const { intention } = mix;
  const asked = params.get("c");
  const categoryId = categories.some((category) => category.id === asked) ? asked : null;
  const select = (id: string | null) => {
    setIsRootOpen(id === null);
    setParams(id === null ? {} : { c: id });
  };
  const scope = categories.find((category) => category.id === intention.scopeCategoryId);
  const headerActions: ViewAction[] = [
    {
      id: "mix",
      label: can(session, "mix.edit") ? message("mixPage.editMix") : message("mixPage.openMix"),
      href: `/mixes/${encodeURIComponent(mix.mixId)}`,
      isInMenu,
    },
  ];
  const name =
    categoryId === null
      ? message("categoriesPage.allCategories")
      : (categories.find((category) => category.id === categoryId)?.name ??
        message("categoriesPage.category"));

  return (
    <>
      <PageHeader
        title={message("mixPage.intentionMixTitle", { name: intention.name })}
        breadcrumb={{
          ...backToIndex,
          detail:
            scope === undefined
              ? message("mixPage.wholeTree")
              : message("mixPage.within", { name: scope.name }),
        }}
        actions={headerActions}
      />
      <MasterDetail
        masterWidth="tree"
        master={
          <CategoryTree
            categories={categories}
            counts={null}
            mix={mix}
            offered={mixTreeValues}
            selectedId={categoryId}
            onSelect={select}
            onVisibleRowsChange={setSwipeRows}
          />
        }
        detail={
          <MixPane
            key={categoryId ?? ""}
            categories={categories}
            mix={mix}
            categoryId={categoryId}
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
        swipe={{
          items: swipeRows,
          idOf: (category) => category.id,
          labelOf: (category) => category.name,
          currentId: categoryId,
          onSelect: select,
        }}
      />
    </>
  );
}

interface MixPaneProps {
  categories: readonly Category[];
  mix: MixTree;
  // Null is *All categories*.
  categoryId: string | null;
  onSelect: (id: string | null) => void;
}

function MixPane({ categories, mix, categoryId, onSelect }: MixPaneProps) {
  const { intention } = mix;
  const category = categories.find((candidate) => candidate.id === categoryId) ?? null;
  const children = categories.filter((candidate) => candidate.parentId === categoryId);
  const isLeaf = category !== null && children.length === 0;
  const scopeId = intention.scopeCategoryId;
  const isOutside = isOutsideScope(categories, scopeId, categoryId);
  const scope = categories.find((candidate) => candidate.id === scopeId);

  return (
    <article className="@container max-w-5xl">
      <header className="mb-4 min-w-0">
        {category !== null && (
          <Breadcrumb categories={categories} category={category} onSelect={onSelect} />
        )}
        <h2 className="text-xl leading-7 font-semibold">
          {category?.name ?? message("categoriesPage.allCategories")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {category === null
            ? scope === undefined
              ? message("mixPage.topLevelSummary")
              : message("mixPage.scopedSummary", { intention: intention.name, scope: scope.name })
            : isLeaf
              ? message("mixPage.leafSummary")
              : message("mixPage.branchSummary", { count: children.length })}
        </p>
      </header>

      <div className="grid gap-4">
        {scope !== undefined && isOutside && (
          <StatusNote
            tone="slate"
            title={message("mixPage.outsideScope", { intention: intention.name })}
          >
            {message("mixPage.outsideScopeText", {
              path: categoryPathOf(categories, scope.id)
                .map((step) => step.name)
                .join(" › "),
            })}
          </StatusNote>
        )}

        {category !== null && !isOutside && category.id !== scopeId && (
          <StatTiles stats={shareStats(categories, mix, category)} />
        )}

        {!isLeaf && !isOutside && (
          <MixSetCard
            categories={categories}
            mix={mix}
            categoryId={categoryId}
            onSelect={onSelect}
          />
        )}
        {category === null && scope !== undefined && (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => onSelect(scope.id)}
          >
            {message("mixPage.openScope", { name: scope.name })}
          </Button>
        )}
        {category === null && (
          <UnallocatedCard categories={categories} mix={mix} onSelect={onSelect} />
        )}
        <FinePrint>{message("mixPage.explainer", { mix: mixNameOf(mix) })}</FinePrint>
      </div>
    </article>
  );
}

function Breadcrumb({
  categories,
  category,
  onSelect,
}: {
  categories: readonly Category[];
  category: Category;
  onSelect: (id: string | null) => void;
}) {
  const above = categoryPathOf(categories, category.id).slice(0, -1);
  const crumbs: { id: string | null; name: string }[] = [
    { id: null, name: message("categoriesPage.allCategories") },
    ...above,
  ];
  return (
    <nav
      aria-label={message("categoryPane.breadcrumbLabel")}
      className="mb-1 text-xs text-muted-foreground"
    >
      {crumbs.map((crumb, position) => (
        <Fragment key={crumb.id ?? ""}>
          {position > 0 && <span className="mx-1 opacity-50">›</span>}
          <button
            type="button"
            className="hover:text-foreground hover:underline"
            onClick={() => onSelect(crumb.id)}
          >
            {crumb.name}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}

function shareStats(categories: readonly Category[], mix: MixTree, category: Category): Stat[] {
  const mixNode = mix.nodes.find((candidate) => candidate.categoryId === category.id);
  const parent = categories.find((candidate) => candidate.id === category.parentId);
  const scope = categories.find((candidate) => candidate.id === mix.intention.scopeCategoryId);
  const share = mixNode?.share ?? null;
  const ofWhole = mixNode?.ofWhole ?? null;
  const actual = mixNode?.actual ?? null;
  return [
    {
      label: message("categoryPane.shareOfParent"),
      value: share === null ? "—" : `${share}%`,
      foot:
        share === null
          ? message("intentionCard.noShare")
          : message("mixPage.shareOf", {
              parent: parent?.name ?? message("categoriesPage.allCategories"),
            }),
    },
    {
      label:
        scope === undefined
          ? message("categoryPane.ofWhole")
          : message("mixPage.of", { name: scope.name }),
      value: ofWhole === null ? "—" : formatPercent(ofWhole),
      foot: message("mixPage.workedOutOnRead"),
    },
    {
      label: message("mixPage.actual"),
      value: actual === null ? "—" : formatPercent(actual),
      foot:
        actual === null
          ? message("categoryPane.noOutput", { name: mix.intention.name })
          : message("mixPage.ofOutput", { name: mix.intention.name }),
    },
  ];
}

// The sets this mix leaves under 100, the top level first.
function UnallocatedCard({
  categories,
  mix,
  onSelect,
}: {
  categories: readonly Category[];
  mix: MixTree;
  onSelect: (id: string | null) => void;
}) {
  const nameOf = (id: string | null) =>
    id === null
      ? message("categoriesPage.allCategories")
      : (categories.find((category) => category.id === id)?.name ?? id);
  const sets = [
    { categoryId: null, unallocated: mix.unallocated, noShareIds: mix.noShareIds },
    ...mix.nodes,
  ].filter((set) => set.unallocated > 0);
  return (
    <DetailCard title={message("mixPage.setsUnder100")}>
      {sets.length === 0 && <Muted>{message("mixPage.allSetsTotal100")}</Muted>}
      {sets.map((set) => (
        <DetailRow
          key={set.categoryId ?? ""}
          aside={
            <span className="text-tone-amber-foreground">
              {message("mixPage.unallocated", { percent: formatPercent(set.unallocated) })}
            </span>
          }
        >
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => onSelect(set.categoryId)}
          >
            <b className="font-semibold">{nameOf(set.categoryId)}</b>
          </button>
          {set.noShareIds.length > 0 && (
            <Muted>
              {" "}
              · {message("mixPage.noShareNames", { names: set.noShareIds.map(nameOf).join(", ") })}
            </Muted>
          )}
        </DetailRow>
      ))}
    </DetailCard>
  );
}
