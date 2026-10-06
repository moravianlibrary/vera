// One category in the Categories pane (docs/demos/shared/page-categories.js `render`; STATUS
// "Categories"; intentions.md §2.3–§2.4): where it sits, its numbers, its children's shares in the
// mix read with what each actually got, or the documents on a leaf, and its custody with whom it
// reaches and from where. *All categories* totals the tree, holds the top-level set and says what
// needs attention: sets under 100 in any mix, and branches nobody holds. A tracker reads its
// owner's mix and says so; outside a scoped intention's subtree the shares are not used, and the
// pane says that instead of showing them.
// TODO(rrandiak): labels move to i18n.

import { skipToken, useQuery } from "@tanstack/react-query";
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import type { CategoryIndex, CategoryMix, CategoryNode, CategoryTotals } from "@/api/categories";
import { listDocuments } from "@/api/documents";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import type { Stat } from "@/components/detail-card";
import { DetailCard, DetailRow, FinePrint, Muted, StatTiles } from "@/components/detail-card";
import { visibleNavigation } from "@/components/layout/navigation";
import { StatusBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { DriftMarker } from "@/components/visualizations/mix-bars";
import { categoryPathOf } from "@/domain/categories";
import { currentIterationOf } from "@/domain/documents";
import type { Category, Intention, Session } from "@/domain/entities";
import { scopeOfIntention } from "@/domain/intentions";
import { can, hasPermission } from "@/domain/permissions";
import { iterationStatusOf } from "@/domain/status";
import {
  isOutOfScope,
  levelOf,
  mixNameOf,
  percentTextOf,
} from "@/features/categories/categories-view";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { useProjectsQuery } from "@/hooks/use-reference-query";
import { formatCount } from "@/lib/format-number";
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
  onPickIntention: (intentionId: string, atCategoryId?: string | null) => void;
}

export function CategoryPane({
  categories,
  index,
  categoryId,
  session,
  onSelect,
  onPickIntention,
}: CategoryPaneProps) {
  const { mix } = index;
  const category = categories.find((candidate) => candidate.id === categoryId) ?? null;
  const node = index.nodes.find((candidate) => candidate.categoryId === categoryId);
  const children = categories.filter((candidate) => candidate.parentId === categoryId);
  const isLeaf = category !== null && children.length === 0;
  const isOutside = mix !== null && isOutOfScope(categories, mix, categoryId);
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

      {mix !== null && (
        <MixNotes
          mix={mix}
          categories={categories}
          categoryId={categoryId}
          session={session}
          onPickIntention={onPickIntention}
        />
      )}

      <StatTiles
        stats={[
          ...(category !== null && mix !== null && !isOutside
            ? shareStats(categories, mix, category)
            : []),
          ...countStats(category === null ? index.totals : node),
        ]}
      />

      <div className="mt-4 grid gap-4">
        {mix !== null && !isLeaf && !isOutside && (
          <SetCard
            categories={categories}
            index={index}
            mix={mix}
            categoryId={categoryId}
            onSelect={onSelect}
          />
        )}
        {category === null && (
          <AttentionCard
            categories={categories}
            index={index}
            onSelect={onSelect}
            onPickIntention={onPickIntention}
          />
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
          <b className="font-semibold">Shares are recursive.</b> <i>Share of parent</i> is what is
          stored; <i>of the whole</i> is it times its parent&apos;s, worked out on read. They are
          percentages, not weights: a share set to 30% is 30% tomorrow. <b>No share</b> is
          unallocated and flagged; <b>0%</b> is a deliberate exclusion. Documents sit on leaves
          only; custody attaches anywhere and reaches everything under it.
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

// The owner's mix is edited only on the owner: `intention.edit_overall` for Overall's, else
// `intention.edit` on the owner (§2.5).
function canEditMixOf(
  session: Session,
  owner: Intention,
  projects: Parameters<typeof scopeOfIntention>[1],
) {
  return owner.isOverall
    ? can(session, "intention.edit_overall")
    : can(session, "intention.edit", scopeOfIntention(owner, projects));
}

interface MixNotesProps {
  mix: CategoryMix;
  categories: readonly Category[];
  categoryId: string | null;
  session: Session;
  onPickIntention: (intentionId: string, atCategoryId?: string | null) => void;
}

function MixNotes({ mix, categories, categoryId, session, onPickIntention }: MixNotesProps) {
  const { data: projects = [] } = useProjectsQuery();
  const { intention, owner, trackers } = mix;
  const isTracker = intention.id !== owner.id;
  const others = trackers.length - 1;
  const scope = categories.find((candidate) => candidate.id === intention.scopeCategoryId);
  return (
    <>
      {isTracker && (
        <div className="mb-4 grid gap-2">
          <StatusNote tone="blue" title={`${intention.name} tracks ${owner.name}`}>
            Editing changes {owner.name}
            {others > 0 && ` and ${others} more`}.
          </StatusNote>
          {canEditMixOf(session, owner, projects) && (
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPickIntention(owner.id, categoryId)}
              >
                Edit {owner.name}&apos;s mix
              </Button>
            </div>
          )}
        </div>
      )}
      {scope !== undefined && isOutOfScope(categories, mix, categoryId) && (
        <StatusNote tone="slate" className="mb-4" title={`Outside ${intention.name}'s scope`}>
          It reads only{" "}
          {categoryPathOf(categories, scope.id)
            .map((step) => step.name)
            .join(" › ")}
          ; shares here are not used by it.
        </StatusNote>
      )}
    </>
  );
}

function shareStats(categories: readonly Category[], mix: CategoryMix, category: Category): Stat[] {
  if (category.id === mix.intention.scopeCategoryId) {
    return [];
  }

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
      foot:
        share === null
          ? `no share in ${mixNameOf(mix)}`
          : `of ${parent?.name ?? "All categories"} · ${mixNameOf(mix)}`,
    },
    {
      label: scope === undefined ? "Of the whole" : `Of ${scope.name}`,
      value: ofWhole === null ? "—" : percentTextOf(ofWhole),
      foot:
        actual === null
          ? `${mix.intention.name} has no output yet`
          : `actual ${percentTextOf(actual)} of ${mix.intention.name}'s output`,
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

interface SetCardProps {
  categories: readonly Category[];
  index: CategoryIndex;
  mix: CategoryMix;
  // Null is the top level.
  categoryId: string | null;
  onSelect: (id: string | null) => void;
}

// One sibling set with the mix: the top level on the root, the children on a branch.
function SetCard({ categories, index, mix, categoryId, onSelect }: SetCardProps) {
  const children = categories.filter((candidate) => candidate.parentId === categoryId);
  const parent = categories.find((candidate) => candidate.id === categoryId);
  const set =
    categoryId === null ? mix : mix.nodes.find((candidate) => candidate.categoryId === categoryId);
  const unallocated = set?.unallocated ?? 0;
  const noShare = children.filter((child) => set?.noShareIds.includes(child.id));
  const others = mix.trackers.filter((tracker) => tracker.id !== mix.intention.id).length;
  const mixNodeOf = (id: string) => mix.nodes.find((candidate) => candidate.categoryId === id);
  const countOf = (id: string) =>
    index.nodes.find((candidate) => candidate.categoryId === id)?.documentCount ?? 0;
  return (
    <DetailCard title={`${categoryId === null ? "Top level" : "Children"} — ${mixNameOf(mix)}`}>
      <table className="w-full text-sm">
        <thead className="text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
          <tr className="border-b">
            <th className="py-1.5 text-left font-semibold">Category</th>
            <th className="text-right font-semibold">
              Share
              {parent === undefined ? (
                ""
              ) : (
                <span className="hidden @md:inline"> of {parent.name}</span>
              )}
            </th>
            <th className="text-right font-semibold">
              <span className="hidden @md:inline">Of the whole</span>
              <span className="@md:hidden">Whole</span>
            </th>
            <th className="text-right font-semibold">Actual</th>
            <th className="hidden text-right font-semibold @sm:table-cell">Docs</th>
          </tr>
        </thead>
        <tbody>
          {children.map((child) => {
            const mixNode = mixNodeOf(child.id);
            const share = mixNode?.share ?? null;
            const ofWhole = mixNode?.ofWhole ?? null;
            const actual = mixNode?.actual ?? null;
            return (
              <tr
                key={child.id}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/60"
                onClick={() => onSelect(child.id)}
              >
                <td className="py-2 font-medium">
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(child.id);
                    }}
                  >
                    {child.name}
                  </button>
                </td>
                <td className="text-right tabular-nums">
                  {share === null ? (
                    <span className="text-tone-amber-foreground">no share</span>
                  ) : share === 0 ? (
                    <Muted>0% — excluded</Muted>
                  ) : (
                    `${share}%`
                  )}
                </td>
                <td className="text-right tabular-nums">
                  {ofWhole === null ? "—" : percentTextOf(ofWhole)}
                </td>
                <td className="text-right whitespace-nowrap tabular-nums">
                  {actual === null ? <Muted>—</Muted> : percentTextOf(actual)}
                  <DriftMarker intended={ofWhole} actual={actual} />
                </td>
                <td className="hidden text-right tabular-nums @sm:table-cell">
                  {countOf(child.id)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {unallocated > 0 && (
        <StatusNote
          tone="amber"
          className="mt-3"
          title={`${percentTextOf(unallocated)} unallocated`}
        >
          {noShare.length > 0 &&
            `${noShare.map((child) => child.name).join(", ")} ${noShare.length === 1 ? "has" : "have"} no share. `}
          Generation allocates only what is allocated and reports the rest — it does not scale the
          others up.
        </StatusNote>
      )}
      <FinePrint>
        <i>Actual</i> is its share of {mix.intention.name}&apos;s output, beside what the mix says
        it should be.
        {others > 0 &&
          ` ${plural(others, "other intention tracks", "other intentions track")} this mix.`}
      </FinePrint>
    </DetailCard>
  );
}

interface AttentionCardProps {
  categories: readonly Category[];
  index: CategoryIndex;
  onSelect: (id: string | null) => void;
  onPickIntention: (intentionId: string, atCategoryId?: string | null) => void;
}

function AttentionCard({ categories, index, onSelect, onPickIntention }: AttentionCardProps) {
  const nameOf = (id: string | null) =>
    id === null
      ? "All categories"
      : (categories.find((category) => category.id === id)?.name ?? id);
  const { sets, unheldIds } = index.attention;
  const rows: { key: string; name: string; what: string; issue: string; open: () => void }[] = [
    ...sets.map((set) => ({
      key: `${set.owner.id}-${set.categoryId ?? ""}`,
      name: nameOf(set.categoryId),
      what: `${set.owner.name}'s mix`,
      issue: [
        `${percentTextOf(set.unallocated)} unallocated`,
        set.noShareIds.length === 0 ? null : `${set.noShareIds.map(nameOf).join(", ")} no share`,
      ]
        .filter((part) => part !== null)
        .join(" · "),
      open: () => onPickIntention(set.owner.id, set.categoryId),
    })),
    ...unheldIds.map((id) => ({
      key: `custody-${id}`,
      name: nameOf(id),
      what: "custody",
      issue: "nobody holds it",
      open: () => onSelect(id),
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
          <button type="button" className="text-left hover:underline" onClick={row.open}>
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
