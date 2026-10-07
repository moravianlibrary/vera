// One category in the Categories pane (docs/demos/shared/page-categories.js `render`; STATUS
// "Categories"; concepts.md *Category*): where it sits, its numbers, its children's shares in
// Overall's mix read with what each actually got, or the documents on a leaf, and its custody with
// whom it reaches and from where. *All categories* totals the tree, holds the top-level set and
// says what needs attention: sets under 100 in Overall's mix, and branches nobody holds. The
// shares are Overall's and read-only here; the set card links to where they are edited
// (intentions.md §2.4).
// TODO(rrandiak): labels move to i18n.

import { skipToken, useQuery } from "@tanstack/react-query";
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import type { CategoryIndex, CategoryNode, CategoryTotals } from "@/api/categories";
import { listDocuments } from "@/api/documents";
import type { MixTree } from "@/api/mixes";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { mixNameOf } from "@/components/category-tree-values";
import type { Stat } from "@/components/detail-card";
import { DetailCard, DetailRow, FinePrint, Muted, StatTiles } from "@/components/detail-card";
import { visibleNavigation } from "@/components/layout/navigation";
import { MixSetCard } from "@/components/mix-set-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { categoryPathOf } from "@/domain/categories";
import { currentIterationOf } from "@/domain/documents";
import type { Category, Session } from "@/domain/entities";
import { can, hasPermission } from "@/domain/permissions";
import { iterationStatusOf } from "@/domain/status";
import { levelOf } from "@/features/categories/categories-view";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { intentionMixHrefOf } from "@/features/intentions/mix-view";
import { formatCount, formatPercent } from "@/lib/format-number";
import { plural } from "@/lib/plural";

// How many of a leaf's documents the pane lists before *Open in Documents*.
const documentPreviewSize = 8;

interface CategoryPaneProps {
  categories: readonly Category[];
  index: CategoryIndex;
  // Null is *All categories*.
  categoryId: string | null;
  session: Session;
  onSelect: (id: string | null) => void;
}

export function CategoryPane({
  categories,
  index,
  categoryId,
  session,
  onSelect,
}: CategoryPaneProps) {
  const { mix } = index;
  const category = categories.find((candidate) => candidate.id === categoryId) ?? null;
  const node = index.nodes.find((candidate) => candidate.categoryId === categoryId);
  const children = categories.filter((candidate) => candidate.parentId === categoryId);
  const isLeaf = category !== null && children.length === 0;
  const documentsHref =
    category !== null && canOpenDocuments(session)
      ? `/documents?category=${encodeURIComponent(category.id)}`
      : null;
  const actions: ViewAction[] =
    documentsHref !== null && !isLeaf
      ? [{ id: "documents", label: "Open in Documents", href: documentsHref }]
      : [];

  return (
    <article className="@container max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <header className="mb-4 min-w-0">
          {category !== null && (
            <Breadcrumb categories={categories} category={category} onSelect={onSelect} />
          )}
          <h2 className="text-xl leading-7 font-semibold">{category?.name ?? "All categories"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {category === null
              ? `${plural(categories.length, "category", "categories")} · ${plural(categories.filter((candidate) => !categories.some((child) => child.parentId === candidate.id)).length, "leaf", "leaves")} · not a category itself`
              : isLeaf
                ? `Level ${levelOf(categories, category.id)} · leaf — classifies documents`
                : `Level ${levelOf(categories, category.id)} · splits its share among ${plural(children.length, "child", "children")}`}
          </p>
        </header>
        <ActionBar actions={actions} className="mb-4" />
      </div>

      <StatTiles
        stats={[
          ...(category !== null && mix !== null ? shareStats(categories, mix, category) : []),
          ...countStats(category === null ? index.totals : node),
        ]}
      />

      <div className="mt-4 grid gap-4">
        {mix !== null && !isLeaf && (
          <MixSetCard
            categories={categories}
            mix={mix}
            categoryId={categoryId}
            onSelect={onSelect}
            documentCountOf={(id) =>
              index.nodes.find((candidate) => candidate.categoryId === id)?.documentCount ?? 0
            }
            action={
              <Button asChild size="sm" variant="outline">
                <Link to={intentionMixHrefOf(mix.owner.id, categoryId)}>
                  {can(session, "intention.edit_overall")
                    ? "Edit the house mix"
                    : "Open the house mix"}
                </Link>
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
        <CustodyCard category={category} node={node} session={session} />
        <FinePrint>
          <b className="font-semibold">A category is a line of work.</b> It classifies the attempt
          and gives custody; it holds no share of its own. The shares shown are the house
          mix&apos;s, Overall&apos;s, and are edited there. Documents sit on leaves only; custody
          attaches anywhere and reaches everything under it.
        </FinePrint>
      </div>
    </article>
  );
}

function canOpenDocuments(session: Session): boolean {
  return (
    hasPermission(session, "iteration.read") &&
    visibleNavigation(session).some((entry) => entry.id === "documents")
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

// Overall's share here; it is never scoped.
function shareStats(categories: readonly Category[], mix: MixTree, category: Category): Stat[] {
  const mixNode = mix.nodes.find((candidate) => candidate.categoryId === category.id);
  const parent = categories.find((candidate) => candidate.id === category.parentId);
  const share = mixNode?.share ?? null;
  const ofWhole = mixNode?.ofWhole ?? null;
  const actual = mixNode?.actual ?? null;
  return [
    {
      label: "Share of parent",
      value: share === null ? "—" : `${share}%`,
      foot:
        share === null
          ? `no share in ${mixNameOf(mix)}`
          : `of ${parent?.name ?? "All categories"} · ${mixNameOf(mix)}`,
    },
    {
      label: "Of the whole",
      value: ofWhole === null ? "—" : formatPercent(ofWhole),
      foot:
        actual === null
          ? `${mix.intention.name} has no output yet`
          : `actual ${formatPercent(actual)} of ${mix.intention.name}'s output`,
    },
  ];
}

function countStats(totals: CategoryTotals | undefined): Stat[] {
  if (totals === undefined) {
    return [];
  }

  return [
    {
      label: "Documents",
      value: totals.documentCount,
      foot: `${formatCount(totals.pages)} pages`,
    },
    {
      label: "Delivered",
      value: `${formatCount(totals.deliveredPages)} pp`,
      foot: `${totals.pages === 0 ? 0 : Math.round((totals.deliveredPages / totals.pages) * 100)}% of its pages`,
    },
    {
      label: "Ready",
      value: `${formatCount(totals.readyPages)} pp`,
      foot: "approved, on no list",
    },
  ];
}

interface AttentionCardProps {
  categories: readonly Category[];
  index: CategoryIndex;
  onSelect: (id: string | null) => void;
}

// Sets under 100 in Overall's mix, the top level first, and branches nobody holds.
function AttentionCard({ categories, index, onSelect }: AttentionCardProps) {
  const nameOf = (id: string | null) =>
    id === null
      ? "All categories"
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
      what: "custody",
      issue: "nobody holds it",
      id,
    })),
  ];
  return (
    <DetailCard title="Needs attention">
      {rows.length === 0 && (
        <Muted>Nothing. Every set adds up to 100 and every branch has somebody.</Muted>
      )}
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
  const { data: page } = useQuery({
    queryKey: [...documentsQueryKey, "list", query, "preview"],
    queryFn:
      canList && documentCount > 0
        ? () => listDocuments(query, { limit: documentPreviewSize })
        : skipToken,
  });
  const action =
    documentsHref === null ? undefined : (
      <Button asChild size="sm" variant="outline">
        <Link to={documentsHref}>Open in Documents</Link>
      </Button>
    );
  if (documentCount === 0) {
    return (
      <DetailCard title="Documents here" action={action}>
        <Muted>
          None. It is a leaf, so it can classify documents; nothing has been approved into it yet.
        </Muted>
      </DetailCard>
    );
  }

  const rest = documentCount - (page?.items.length ?? 0);
  return (
    <DetailCard title={`Documents here — ${documentCount}`} action={action}>
      {page?.items.map((record) => {
        const iteration = currentIterationOf(record);
        return (
          <DetailRow
            key={record.document.id}
            aside={
              iteration === null ? undefined : <StatusBadge status={iterationStatusOf(iteration)} />
            }
          >
            {record.document.title}
          </DetailRow>
        );
      })}
      {page !== undefined && rest > 0 && <FinePrint>and {rest} more.</FinePrint>}
      <FinePrint>
        Documents sit on leaves only, so a category under {category.name} means moving these{" "}
        {documentCount} into it — that is <b className="font-semibold">Refine</b>.
      </FinePrint>
    </DetailCard>
  );
}

interface CustodyCardProps {
  category: Category | null;
  node: CategoryNode | undefined;
  session: Session;
}

function CustodyCard({ category, node, session }: CustodyCardProps): ReactNode {
  if (category === null || node === undefined) {
    return (
      <DetailCard
        title="Custody"
        action={
          visibleNavigation(session).some((entry) => entry.id === "access") ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/access">Users &amp; Groups</Link>
            </Button>
          ) : undefined
        }
      >
        <Muted>
          Custody over the whole tree is the <code>any</code> scope, a role granted in{" "}
          <b className="font-semibold">Users &amp; Groups</b>, not a grant here. Custody is granted
          on a category and reaches everything under it.
        </Muted>
      </DetailCard>
    );
  }

  return (
    <DetailCard title="Custody">
      <div className="grid gap-x-8 gap-y-4 @md:grid-cols-2">
        <div>
          <div className="text-xs text-muted-foreground">Granted here</div>
          {node.grants.length === 0 && <div className="mt-1 text-muted-foreground">nothing</div>}
          {node.grants.map((grant) => (
            <div key={`${grant.kind}-${grant.id}`} className="mt-1">
              {grant.name}
              {grant.kind === "group" && <Muted> · group</Muted>}
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Who it reaches</div>
          {node.reach.length === 0 && (
            <div className="mt-1 text-tone-amber-foreground">
              nobody — nobody&apos;s validation queue holds it
            </div>
          )}
          {node.reach.map((reach) => {
            const where =
              reach.grantedOn.id === category.id ? "here" : `on ${reach.grantedOn.name}`;
            return (
              <div key={reach.userId} className="mt-1">
                {reach.name}{" "}
                <Muted>
                  · {reach.group === null ? "direct" : reach.group.name}, {where}
                </Muted>
              </div>
            );
          })}
        </div>
      </div>
      <FinePrint>
        Custody inherits <b className="font-semibold">downward</b>: granted here, it also reaches
        every category under {category.name}.
      </FinePrint>
    </DetailCard>
  );
}
