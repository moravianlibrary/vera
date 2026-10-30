// One category in the Categories pane (docs/demos/shared/page-categories.js `render`; STATUS
// "Categories"; concepts.md *Category*): where it sits, its numbers, its children's shares in
// the selected mix read with what each actually got, or the documents on a leaf, and its custody with
// whom it reaches and from where. *All categories* totals the tree, holds the top-level set and
// says what needs attention: sets under 100 in the selected mix, and branches nobody holds. The
// shares are read-only here; the set card links to where they are edited
// (intentions.md §2.4). Whoever may change this part of the tree gets *Edit…*, *+ Child category*
// (*+ Top-level category* on the root, at `any`), *Refine…* on a leaf that holds documents,
// *Delete…* on an empty leaf, and *Grant custody…* on the custody card (permissions.md §3).
import { skipToken, useQuery } from "@tanstack/react-query";
import type { CategoryIndex, CategoryNode, CategoryTotals } from "@vera/contract/categories";
import type { MixTree } from "@vera/contract/mixes";
import { categoryPathOf, isOutsideScope, scopeOfCategory } from "@vera/domain/categories";
import { currentIterationOf } from "@vera/domain/documents";
import type { Category, Session } from "@vera/domain/entities";
import { can, hasPermission } from "@vera/domain/permissions";
import { iterationStatusOf } from "@vera/domain/status";
import { Fragment, type ReactNode, useState } from "react";
import { Link } from "react-router";
import { listDocuments } from "@/api/documents";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { mixNameOf } from "@/components/category-tree-values";
import type { Stat } from "@/components/detail-card";
import { DetailCard, DetailRow, FinePrint, Muted, StatTiles } from "@/components/detail-card";
import { visibleNavigation } from "@/components/layout/navigation";
import { MixSetCard } from "@/components/mix-set-card";
import { failureOf, QueryState } from "@/components/query-state";
import { StatusBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { levelOf } from "@/features/categories/categories-view";
import type { CategoryNotice } from "@/features/categories/category-dialogs";
import {
  CategoryFormDialog,
  CustodyDialog,
  DeleteCategoryDialog,
} from "@/features/categories/category-dialogs";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { i18n } from "@/i18n";
import { formatCount, formatPages, formatPercent } from "@/lib/format-number";

const message = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "categories", ...options });

// How many of a leaf's documents the pane lists before *Open in Documents*.
const documentPreviewSize = 8;

interface CategoryPaneProps {
  categories: readonly Category[];
  index: CategoryIndex;
  // Null is *All categories*.
  categoryId: string | null;
  session: Session;
  notice: CategoryNotice | null;
  onSelect: (id: string | null) => void;
  // Shown after a change: the category it left open, null the root, and what to say.
  onChanged: (id: string | null, notice: CategoryNotice) => void;
  onRefine: () => void;
}

type PaneDialog = "edit" | "child" | "delete" | "custody";

export function CategoryPane({
  categories,
  index,
  categoryId,
  session,
  notice,
  onSelect,
  onChanged,
  onRefine,
}: CategoryPaneProps) {
  const [dialog, setDialog] = useState<PaneDialog | null>(null);
  const { mix } = index;
  const category = categories.find((candidate) => candidate.id === categoryId) ?? null;
  const node = index.nodes.find((candidate) => candidate.categoryId === categoryId);
  const children = categories.filter((candidate) => candidate.parentId === categoryId);
  const isLeaf = category !== null && children.length === 0;
  const isInsideMix =
    mix !== null && !isOutsideScope(categories, mix.intention.scopeCategoryId, categoryId);
  const documentsHref =
    category !== null && canOpenDocuments(session)
      ? `/documents?category=${encodeURIComponent(category.id)}`
      : null;
  const holdsDocuments = (id: string) =>
    (index.nodes.find((candidate) => candidate.categoryId === id)?.documentCount ?? 0) > 0;
  const canEdit = can(session, "category.edit", scopeOfCategory(categories, categoryId));
  const canGrant =
    category !== null &&
    can(session, "category.grant_custody", scopeOfCategory(categories, category.id));
  const isFull = isLeaf && holdsDocuments(category.id);
  const actions: ViewAction[] = [
    ...(documentsHref !== null && !isLeaf
      ? [{ id: "documents", label: message("categoryPane.openDocuments"), href: documentsHref }]
      : []),
    ...(canEdit && category !== null
      ? [{ id: "edit", label: message("categoryPane.edit"), onSelect: () => setDialog("edit") }]
      : []),
    ...(canEdit && isFull
      ? [{ id: "refine", label: message("categoryPane.refine"), onSelect: onRefine }]
      : []),
    ...(canEdit && !isFull
      ? [
          {
            id: "child",
            label:
              category === null
                ? message("categoryPane.addTopLevel")
                : message("categoryPane.addChild"),
            onSelect: () => setDialog("child"),
          },
        ]
      : []),
    ...(canEdit && isLeaf && !isFull
      ? [
          {
            id: "delete",
            label: message("categoryPane.delete"),
            isDestructive: true,
            isInMenu: true,
            onSelect: () => setDialog("delete"),
          },
        ]
      : []),
  ];
  const closeDialog = () => setDialog(null);

  return (
    <article className="@container w-full min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <header className="mb-4 min-w-0">
          {category !== null && (
            <Breadcrumb categories={categories} category={category} onSelect={onSelect} />
          )}
          <h2 className="text-xl leading-7 font-semibold">
            {category?.name ?? message("categoriesPage.allCategories")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {category === null
              ? message("categoryPane.rootSummary", {
                  categories: message("categoryPane.categoryCount", { count: categories.length }),
                  leaves: message("categoryPane.leafCount", {
                    count: categories.filter(
                      (candidate) => !categories.some((child) => child.parentId === candidate.id),
                    ).length,
                  }),
                })
              : isLeaf
                ? message("categoryPane.leafSummary", { level: levelOf(categories, category.id) })
                : message("categoryPane.branchSummary", {
                    level: levelOf(categories, category.id),
                    children: message("categoryPane.childCount", { count: children.length }),
                  })}
          </p>
        </header>
        <ActionBar actions={actions} menuLabel={message("categoryPane.more")} className="mb-4" />
      </div>

      {notice !== null && (
        <StatusNote tone="green" title={notice.title} className="mb-4">
          {notice.text}
        </StatusNote>
      )}

      <StatTiles
        stats={[
          ...(category !== null && isInsideMix ? shareStats(categories, mix, category) : []),
          ...countStats(category === null ? index.totals : node),
        ]}
      />

      <div className="mt-4 grid gap-4">
        {mix !== null && isInsideMix && !isLeaf && (
          <MixSetCard
            showActual={false}
            categories={categories}
            mix={mix}
            categoryId={categoryId}
            onSelect={onSelect}
            documentCountOf={(id) =>
              index.nodes.find((candidate) => candidate.categoryId === id)?.documentCount ?? 0
            }
            action={
              <Button asChild size="sm" variant="outline">
                <Link to={`/mixes/${mix.mixId ?? ""}`}>{message("categoryPane.openMix")}</Link>
              </Button>
            }
          />
        )}
        {category === null && (
          <AttentionCard categories={categories} index={index} onSelect={onSelect} />
        )}
        {isLeaf && node !== undefined && (
          <DocumentsHereCard
            category={category}
            documentCount={node.documentCount}
            documentsHref={documentsHref}
            canList={hasPermission(session, "iteration.read")}
          />
        )}
        <CustodyCard
          category={category}
          node={node}
          session={session}
          onGrant={canGrant ? () => setDialog("custody") : undefined}
        />
        <FinePrint>{message("categoryPane.finePrint")}</FinePrint>
      </div>

      {/* Mounted while open, so each starts from what the page has now. */}
      {(dialog === "edit" || dialog === "child") && (
        <CategoryFormDialog
          isOpen
          onClose={closeDialog}
          categories={categories}
          category={dialog === "edit" ? category : null}
          parentId={categoryId}
          holdsDocuments={holdsDocuments}
          session={session}
          onSaved={(saved, savedNotice) => onChanged(saved.id, savedNotice)}
        />
      )}
      {dialog === "delete" && category !== null && (
        <DeleteCategoryDialog
          isOpen
          onClose={closeDialog}
          categories={categories}
          category={category}
          onDeleted={(deletedNotice) => onChanged(category.parentId, deletedNotice)}
        />
      )}
      {dialog === "custody" && category !== null && node !== undefined && (
        <CustodyDialog
          isOpen
          onClose={closeDialog}
          categories={categories}
          category={category}
          node={node}
          session={session}
          onSaved={(savedNotice) => onChanged(category.id, savedNotice)}
        />
      )}
    </article>
  );
}

function canOpenDocuments(session: Session): boolean {
  return (
    hasPermission(session, "iteration.read") &&
    visibleNavigation(session).some((entry) => entry.id === "documents")
  );
}

export function Breadcrumb({
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

// The selected mix's share here, when this category sits inside its scope.
function shareStats(categories: readonly Category[], mix: MixTree, category: Category): Stat[] {
  const mixNode = mix.nodes.find((candidate) => candidate.categoryId === category.id);
  const parent = categories.find((candidate) => candidate.id === category.parentId);
  const share = mixNode?.share ?? null;
  const ofWhole = mixNode?.ofWhole ?? null;
  const actual = mixNode?.actual ?? null;
  return [
    {
      label: message("categoryPane.shareOfParent"),
      value: share === null ? "—" : `${share}%`,
      foot:
        share === null
          ? message("categoryPane.noShareIn", { mix: mixNameOf(mix) })
          : message("categoryPane.shareOf", {
              parent: parent?.name ?? message("categoriesPage.allCategories"),
              mix: mixNameOf(mix),
            }),
    },
    {
      label: message("categoryPane.ofWhole"),
      value: ofWhole === null ? "—" : formatPercent(ofWhole),
      foot:
        actual === null
          ? message("categoryPane.noOutput", { name: mix.intention.name })
          : message("categoryPane.actualOutput", {
              actual: formatPercent(actual),
              name: mix.intention.name,
            }),
    },
  ];
}

function countStats(totals: CategoryTotals | undefined): Stat[] {
  if (totals === undefined) {
    return [];
  }

  return [
    {
      label: message("categoryPane.documents"),
      value: totals.documentCount,
      foot: message("categoryPane.pages", { count: formatCount(totals.pages) }),
    },
    {
      label: message("categoryPane.delivered"),
      value: formatPages(totals.deliveredPages),
      foot: message("categoryPane.percentOfPages", {
        percent: totals.pages === 0 ? 0 : Math.round((totals.deliveredPages / totals.pages) * 100),
      }),
    },
    {
      label: message("categoryPane.ready"),
      value: formatPages(totals.readyPages),
      foot: message("categoryPane.approvedNoList"),
    },
  ];
}

interface AttentionCardProps {
  categories: readonly Category[];
  index: CategoryIndex;
  onSelect: (id: string | null) => void;
}

// Sets under 100 in the selected mix, the top level first, and branches nobody holds.
function AttentionCard({ categories, index, onSelect }: AttentionCardProps) {
  const nameOf = (id: string | null) =>
    id === null
      ? message("categoriesPage.allCategories")
      : (categories.find((category) => category.id === id)?.name ?? id);
  const { mix } = index;
  const sets =
    mix === null
      ? []
      : [
          { categoryId: null, unallocated: mix.unallocated, noShareIds: mix.noShareIds },
          ...mix.nodes,
        ].filter((set) => set.unallocated > 0);
  const rows: { key: string; name: string; what: string; issue: string; id: string | null }[] = [
    ...sets.map((set) => ({
      key: `set-${set.categoryId ?? ""}`,
      name: nameOf(set.categoryId),
      what: mix === null ? "" : mixNameOf(mix),
      issue: [
        `${formatPercent(set.unallocated)} unallocated`,
        set.noShareIds.length === 0 ? null : `${set.noShareIds.map(nameOf).join(", ")} no share`,
      ]
        .filter((part) => part !== null)
        .join(" · "),
      id: set.categoryId,
    })),
    ...index.unheldIds.map((id) => ({
      key: `custody-${id}`,
      name: nameOf(id),
      what: message("categoryPane.custody"),
      issue: message("categoryPane.nobodyHolds"),
      id,
    })),
  ];
  return (
    <DetailCard title={message("categoryPane.needsAttention")}>
      {rows.length === 0 && <Muted>{message("categoryPane.noAttentionNeeded")}</Muted>}
      {rows.map((row) => (
        <DetailRow
          key={row.key}
          aside={<span className="text-tone-amber-foreground">{row.issue}</span>}
        >
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => onSelect(row.id)}
          >
            <b className="font-semibold">{row.name}</b>
          </button>{" "}
          <Muted>· {row.what}</Muted>
        </DetailRow>
      ))}
    </DetailCard>
  );
}

interface DocumentsHereCardProps {
  category: Category;
  documentCount: number;
  documentsHref: string | null;
  // Whether the person may list documents at all.
  canList: boolean;
}

function DocumentsHereCard({
  category,
  documentCount,
  documentsHref,
  canList,
}: DocumentsHereCardProps) {
  const query = { categoryIds: [category.id] };
  const documentsQuery = useQuery({
    queryKey: [...documentsQueryKey, "list", query, "preview"],
    queryFn:
      canList && documentCount > 0
        ? () => listDocuments(query, { limit: documentPreviewSize })
        : skipToken,
  });
  const { data: page } = documentsQuery;
  const action =
    documentsHref === null ? undefined : (
      <Button asChild size="sm" variant="outline">
        <Link to={documentsHref}>{message("categoryPane.openDocuments")}</Link>
      </Button>
    );
  if (documentCount === 0) {
    return (
      <DetailCard title={message("categoryPane.documentsHere")} action={action}>
        <Muted>{message("categoryPane.noDocumentsYet")}</Muted>
      </DetailCard>
    );
  }

  const rest = documentCount - (page?.items.length ?? 0);
  return (
    <DetailCard
      title={message("categoryPane.documentsCount", { count: documentCount })}
      action={action}
    >
      <QueryState
        isLoading={documentsQuery.isLoading}
        failure={failureOf(documentsQuery, message("categoryPane.loadDocumentsError"))}
        loadingText={message("categoryPane.loadingDocuments")}
      >
        {page?.items.map((record) => {
          const iteration = currentIterationOf(record);
          return (
            <DetailRow
              key={record.document.id}
              aside={
                iteration === null ? undefined : (
                  <StatusBadge status={iterationStatusOf(iteration)} />
                )
              }
            >
              {record.document.title}
            </DetailRow>
          );
        })}
        {page !== undefined && rest > 0 && (
          <FinePrint>{message("categoryPane.andMore", { count: rest })}</FinePrint>
        )}
      </QueryState>
      <FinePrint>
        {message("categoryPane.refineExplanation", {
          category: category.name,
          count: documentCount,
        })}
      </FinePrint>
    </DetailCard>
  );
}

interface CustodyCardProps {
  category: Category | null;
  node: CategoryNode | undefined;
  session: Session;
  // Where the person may grant custody here.
  onGrant: (() => void) | undefined;
}

function CustodyCard({ category, node, session, onGrant }: CustodyCardProps): ReactNode {
  if (category === null || node === undefined) {
    return (
      <DetailCard
        title={message("categoryPane.custody")}
        action={
          visibleNavigation(session).some((entry) => entry.id === "access") ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/access">{message("categoryPane.userManagement")}</Link>
            </Button>
          ) : undefined
        }
      >
        <Muted>{message("categoryPane.rootCustodyExplanation")}</Muted>
      </DetailCard>
    );
  }

  return (
    <DetailCard
      title={message("categoryPane.custody")}
      action={
        onGrant === undefined ? undefined : (
          <Button size="sm" variant="outline" onClick={onGrant}>
            {message("categoryPane.grantCustody")}
          </Button>
        )
      }
    >
      <div className="grid gap-x-8 gap-y-4 @md:grid-cols-2">
        <div>
          <div className="text-xs text-muted-foreground">{message("categoryPane.grantedHere")}</div>
          {node.grants.length === 0 && (
            <div className="mt-1 text-muted-foreground">{message("categoryPane.nothing")}</div>
          )}
          {node.grants.map((grant) => (
            <div key={`${grant.kind}-${grant.id}`} className="mt-1">
              {grant.name}
              {grant.kind === "group" && <Muted> · {message("categoryPane.group")}</Muted>}
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">
            {message("categoryPane.whoItReaches")}
          </div>
          {node.reach.length === 0 && (
            <div className="mt-1 text-tone-amber-foreground">
              {message("categoryPane.noOneReached")}
            </div>
          )}
          {node.reach.map((reach) => {
            const where =
              reach.grantedOn.id === category.id
                ? message("categoryPane.here")
                : message("categoryPane.onCategory", { name: reach.grantedOn.name });
            return (
              <div key={reach.userId} className="mt-1">
                {reach.name}{" "}
                <Muted>
                  · {reach.group === null ? message("categoryPane.direct") : reach.group.name},{" "}
                  {where}
                </Muted>
              </div>
            );
          })}
        </div>
      </div>
      <FinePrint>
        {message("categoryPane.custodyInheritance", { category: category.name })}
      </FinePrint>
    </DetailCard>
  );
}
