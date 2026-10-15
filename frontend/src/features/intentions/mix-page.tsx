// An intention's Mix, `/intentions/:intentionId/mix` (intentions.md §2.3–§2.5; concepts.md *Mix*,
// decided 2026-10-07; docs/demos/shared/page-categories.js for the tree and the set editor, which
// the demo still keeps on Categories). The category tree with the intention's shares, read
// against its own output, and one category in the pane, *All categories* when none is picked.
// The percentages are edited here, one sibling set at a time, on the intention that owns the mix,
// Overall's only with `intention.edit@any`. A tracker shows its owner's mix with a line, *Edit
// [owner]'s mix* and *Detach*; a scoped intention shows its subtree, the rest dimmed and unused.
// `?c=` is the category open, pushing a history entry. On a phone the pane is a sheet.
// TODO(rrandiak): labels move to i18n.

import { Fragment, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import type { IntentionMixDetail, MixTree } from "@/api/mixes";
import type { ViewAction } from "@/components/actions/action-bar";
import { CategoryTree } from "@/components/category-tree";
import { mixNameOf, mixTreeValues } from "@/components/category-tree-values";
import type { Stat } from "@/components/detail-card";
import { DetailCard, DetailRow, FinePrint, Muted, StatTiles } from "@/components/detail-card";
import { MasterDetail } from "@/components/layout/master-detail";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { MixSetCard } from "@/components/mix-set-card";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { categoryPathOf, isInSubtree, isOutsideScope } from "@/domain/categories";
import type { Category } from "@/domain/entities";
import { can } from "@/domain/permissions";
import { DetachDialog, ProportionsDialog } from "@/features/intentions/mix-dialogs";
import { intentionMixHrefOf } from "@/features/intentions/mix-view";
import { useIntentionMixQuery } from "@/features/intentions/use-intentions-query";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { useSessionQuery } from "@/hooks/use-session-query";
import { useTier } from "@/hooks/use-tier";
import { formatPercent } from "@/lib/format-number";
import { plural } from "@/lib/plural";

// The mix is edited on its owner, with `intention.edit` on it (§2.5).
interface Notice {
  title: string;
  text: string;
}

export function IntentionMixPage() {
  const { intentionId = null } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: detail } = useIntentionMixQuery(intentionId);
  const { data: liveCategories } = useCategoriesQuery();
  const { data: session } = useSessionQuery();
  const [isRootOpen, setIsRootOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialog, setDialog] = useState<"proportions" | "detach" | null>(null);
  // A phone's header has no room for an owner's name beside the title.
  const isInMenu = useTier() === "phone";
  const backToIndex = {
    label: "Intentions",
    href: intentionId === null ? "/intentions" : `/intentions?i=${encodeURIComponent(intentionId)}`,
  };

  if (detail === null) {
    return (
      <>
        <PageHeader title="Mix" breadcrumb={backToIndex} />
        <PageContent>
          <p className="text-sm text-muted-foreground">
            No such intention, or it is not yours to see.
          </p>
        </PageContent>
      </>
    );
  }

  if (detail === undefined || liveCategories === undefined || session === undefined) {
    return <PageHeader title="Mix" breadcrumb={backToIndex} />;
  }

  const { mix, trackers } = detail;
  const categories = detail.archivedCategories ?? liveCategories;
  const { intention, owner } = mix;
  const isTracker = intention.id !== owner.id;
  const asked = params.get("c");
  const categoryId = categories.some((category) => category.id === asked) ? asked : null;
  const select = (id: string | null) => {
    setIsRootOpen(id === null);
    setNotice(null);
    setParams(id === null ? {} : { c: id });
  };
  const canEditOwner = false;
  const canEditIntention = false;
  const scope = categories.find((category) => category.id === intention.scopeCategoryId);
  const headerActions: ViewAction[] = [
    {
      id: "shared-mix",
      label: can(session, "mix.edit") ? "Edit shared mix" : "View shared mix",
      href: `/mixes/${intention.distributionId}`,
      isInMenu,
    },
    ...(isTracker
      ? [
          ...(canEditOwner
            ? [
                {
                  id: "owner",
                  label: `Edit ${owner.name}'s mix`,
                  href: intentionMixHrefOf(owner.id, categoryId),
                  isInMenu,
                },
              ]
            : []),
          ...(canEditIntention
            ? [
                {
                  id: "detach",
                  label: `Detach ${intention.name}`,
                  onSelect: () => setDialog("detach"),
                  isInMenu,
                },
              ]
            : []),
        ]
      : []),
  ];
  const name =
    categoryId === null
      ? "All categories"
      : (categories.find((category) => category.id === categoryId)?.name ?? "Category");

  return (
    <>
      <PageHeader
        title={`${intention.name} — mix`}
        breadcrumb={{
          ...backToIndex,
          detail: scope === undefined ? "over the whole tree" : `within ${scope.name}`,
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
          />
        }
        detail={
          <MixPane
            key={categoryId ?? ""}
            categories={categories}
            detail={detail}
            categoryId={categoryId}
            notice={notice}
            canEditSet={!isTracker && canEditOwner}
            onSelect={select}
            onEditSet={() => setDialog("proportions")}
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
      {!isTracker && canEditOwner && (
        <ProportionsDialog
          key={`${categoryId ?? ""}-${detail.revision}`}
          isOpen={dialog === "proportions"}
          onClose={() => setDialog(null)}
          categories={categories}
          detail={detail}
          parentId={categoryId}
          canKeepOldFor={() => can(session, "intention.edit")}
          onSaved={(saved, keptCount) =>
            setNotice({
              title: "Saved",
              text: `${mixNameOf(saved.mix)}, ${name === "All categories" ? "top level" : name}${
                setUnallocatedOf(saved.mix, categoryId) > 0
                  ? ` — ${formatPercent(setUnallocatedOf(saved.mix, categoryId))} left unallocated, and flagged`
                  : " — complete"
              }.${keptCount > 0 ? ` ${plural(keptCount, "intention keeps", "intentions keep")} the old mix, detached.` : ""}${
                trackers.length - keptCount > 0
                  ? ` ${plural(trackers.length - keptCount, "other intention changed", "other intentions changed")} with it.`
                  : ""
              }`,
            })
          }
        />
      )}
      {isTracker && canEditIntention && (
        <DetachDialog
          isOpen={dialog === "detach"}
          onClose={() => setDialog(null)}
          intention={intention}
          owner={owner}
          onDetached={() => {
            // Opens the pane on a phone, where the notice is.
            setIsRootOpen(categoryId === null);
            setNotice({
              title: `${intention.name} has its own mix`,
              text: "Edit its proportions here; nobody else changes with it.",
            });
          }}
        />
      )}
    </>
  );
}

function setUnallocatedOf(mix: MixTree, categoryId: string | null): number {
  return categoryId === null
    ? mix.unallocated
    : (mix.nodes.find((node) => node.categoryId === categoryId)?.unallocated ?? 0);
}

interface MixPaneProps {
  categories: readonly Category[];
  detail: IntentionMixDetail;
  // Null is *All categories*.
  categoryId: string | null;
  notice: Notice | null;
  // The intention owns the mix and the person may edit it.
  canEditSet: boolean;
  onSelect: (id: string | null) => void;
  onEditSet: () => void;
}

function MixPane({
  categories,
  detail,
  categoryId,
  notice,
  canEditSet,
  onSelect,
  onEditSet,
}: MixPaneProps) {
  const { mix, trackers } = detail;
  const { intention, owner } = mix;
  const isTracker = intention.id !== owner.id;
  const category = categories.find((candidate) => candidate.id === categoryId) ?? null;
  const children = categories.filter((candidate) => candidate.parentId === categoryId);
  const isLeaf = category !== null && children.length === 0;
  const scopeId = intention.scopeCategoryId;
  const isOutside = isOutsideScope(categories, scopeId, categoryId);
  const scope = categories.find((candidate) => candidate.id === scopeId);
  // A scoped intention edits its scope's set and those below it.
  const isSetEditable =
    canEditSet &&
    !isLeaf &&
    (scopeId === null || (categoryId !== null && isInSubtree(categories, categoryId, scopeId)));
  // Those changing with it, besides the intention read.
  const otherTrackerCount = isTracker ? trackers.length - 1 : trackers.length;

  return (
    <article className="@container max-w-5xl">
      <header className="mb-4 min-w-0">
        {category !== null && (
          <Breadcrumb categories={categories} category={category} onSelect={onSelect} />
        )}
        <h2 className="text-xl leading-7 font-semibold">{category?.name ?? "All categories"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {category === null
            ? scope === undefined
              ? "the top level splits 100% of the whole"
              : `${intention.name} reads only ${scope.name}`
            : isLeaf
              ? "a leaf — its share divides no further"
              : `splits its share among ${plural(children.length, "child", "children")}`}
        </p>
      </header>

      <div className="grid gap-4">
        {notice !== null && (
          <StatusNote tone="green" title={notice.title}>
            {notice.text}
          </StatusNote>
        )}
        {isTracker && (
          <StatusNote tone="blue" title={`${intention.name} tracks ${owner.name}`}>
            Editing changes {owner.name}
            {trackers.length > 1 && ` and ${trackers.length - 1} more`}.
          </StatusNote>
        )}
        {scope !== undefined && isOutside && (
          <StatusNote tone="slate" title={`Outside ${intention.name}'s scope`}>
            It reads only{" "}
            {categoryPathOf(categories, scope.id)
              .map((step) => step.name)
              .join(" › ")}
            ; shares here are not used by it.
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
            otherTrackerCount={otherTrackerCount}
            action={
              isSetEditable ? (
                <Button size="sm" variant="outline" onClick={onEditSet}>
                  Edit proportions…
                </Button>
              ) : undefined
            }
          />
        )}
        {category === null && scope !== undefined && (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => onSelect(scope.id)}
          >
            Open {scope.name}
          </Button>
        )}
        {category === null && (
          <UnallocatedCard categories={categories} mix={mix} onSelect={onSelect} />
        )}
        <FinePrint>
          <b className="font-semibold">Shares are recursive.</b> <i>Share of parent</i> is what is
          stored; <i>of the whole</i> is it times its parent&apos;s, worked out on read. They are
          percentages, not weights: a share set to 30% is 30% tomorrow. <b>No share</b> is
          unallocated and flagged; <b>0%</b> is a deliberate exclusion. A category holds no share of
          its own: these numbers are {mixNameOf(mix)}.
        </FinePrint>
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
    { id: null, name: "All categories" },
    ...above,
  ];
  return (
    <nav aria-label="Where it sits" className="mb-1 text-xs text-muted-foreground">
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
      label: "Share of parent",
      value: share === null ? "—" : `${share}%`,
      foot: share === null ? "no share" : `of ${parent?.name ?? "All categories"}`,
    },
    {
      label: scope === undefined ? "Of the whole" : `Of ${scope.name}`,
      value: ofWhole === null ? "—" : formatPercent(ofWhole),
      foot: "worked out on read",
    },
    {
      label: "Actual",
      value: actual === null ? "—" : formatPercent(actual),
      foot:
        actual === null
          ? `${mix.intention.name} has no output yet`
          : `of ${mix.intention.name}'s output`,
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
      ? "All categories"
      : (categories.find((category) => category.id === id)?.name ?? id);
  const sets = [
    { categoryId: null, unallocated: mix.unallocated, noShareIds: mix.noShareIds },
    ...mix.nodes,
  ].filter((set) => set.unallocated > 0);
  return (
    <DetailCard title="Sets under 100">
      {sets.length === 0 && <Muted>None. Every set this mix uses adds up to 100.</Muted>}
      {sets.map((set) => (
        <DetailRow
          key={set.categoryId ?? ""}
          aside={
            <span className="text-tone-amber-foreground">
              {formatPercent(set.unallocated)} unallocated
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
            <Muted> · {set.noShareIds.map(nameOf).join(", ")} no share</Muted>
          )}
        </DetailRow>
      ))}
    </DetailCard>
  );
}
