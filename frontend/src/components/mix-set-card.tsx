// One sibling set of a mix (intentions.md §1, §1.1.1; docs/demos/shared/page-categories.js
// `render`): each child's share of its parent, of the whole (or the scope), and what it actually
// got of the intention's output, with the drift marker outside the band; what the set leaves
// unallocated, flagged, never scaled. Categories and an intention's Mix show the mix read-only; it
// is edited on Mixes (ACT-mix-save), which Categories links to as the card's action.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import type { MixTree } from "@/api/mixes";
import { mixNameOf } from "@/components/category-tree-values";
import { DetailCard, FinePrint, Muted } from "@/components/detail-card";
import { StatusNote } from "@/components/status-note";
import { DriftMarker } from "@/components/visualizations/mix-bars";
import type { Category } from "@/domain/entities";
import { formatPercent } from "@/lib/format-number";

interface MixSetCardProps {
  showActual?: boolean;
  categories: readonly Category[];
  mix: MixTree;
  // The parent; null is the top level.
  categoryId: string | null;
  onSelect: (id: string | null) => void;
  // A Docs column, where the page knows what each category holds.
  documentCountOf?: (categoryId: string) => number;
  action?: ReactNode;
}

export function MixSetCard({
  showActual = true,
  categories,
  mix,
  categoryId,
  onSelect,
  documentCountOf,
  action,
}: MixSetCardProps) {
  const children = categories.filter((candidate) => candidate.parentId === categoryId);
  const parent = categories.find((candidate) => candidate.id === categoryId);
  const set =
    categoryId === null ? mix : mix.nodes.find((candidate) => candidate.categoryId === categoryId);
  const unallocated = set?.unallocated ?? 0;
  const noShare = children.filter((child) => set?.noShareIds.includes(child.id));
  const mixNodeOf = (id: string) => mix.nodes.find((candidate) => candidate.categoryId === id);
  return (
    <DetailCard
      title={`${categoryId === null ? "Top level" : "Children"} — ${mixNameOf(mix)}`}
      action={action}
    >
      <table className="w-full text-sm">
        <thead className="text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
          <tr className="border-b">
            <th className="py-1.5 text-left font-semibold">Category</th>
            <th className="text-right font-semibold">
              Share
              {parent !== undefined && <span className="hidden @md:inline"> of {parent.name}</span>}
            </th>
            <th className="text-right font-semibold">
              <span className="hidden @md:inline">Of the whole</span>
              <span className="@md:hidden">Whole</span>
            </th>
            {showActual && <th className="text-right font-semibold">Actual</th>}
            {documentCountOf !== undefined && (
              <th className="hidden text-right font-semibold @sm:table-cell">Docs</th>
            )}
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
                  {ofWhole === null ? "—" : formatPercent(ofWhole)}
                </td>
                {showActual && (
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {actual === null ? <Muted>—</Muted> : formatPercent(actual)}
                    <DriftMarker intended={ofWhole} actual={actual} />
                  </td>
                )}
                {documentCountOf !== undefined && (
                  <td className="hidden text-right tabular-nums @sm:table-cell">
                    {documentCountOf(child.id)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {unallocated > 0 && (
        <StatusNote
          tone="amber"
          className="mt-3"
          title={`${formatPercent(unallocated)} unallocated`}
        >
          {noShare.length > 0 &&
            `${noShare.map((child) => child.name).join(", ")} ${noShare.length === 1 ? "has" : "have"} no share. `}
          Generation allocates only what is allocated and reports the rest — it does not scale the
          others up.
        </StatusNote>
      )}
      {showActual && (
        <FinePrint>
          <i>Actual</i> is its share of {mix.intention.name}&apos;s output, beside what the mix says
          it should be.
        </FinePrint>
      )}
    </DetailCard>
  );
}
