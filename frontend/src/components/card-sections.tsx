// A page of cards in sections (component-interfaces.md §1.4; docs/demos/shared/vera.css .pj-cards):
// for the few records that run at once, each a card with its numbers, where a queue would be
// master–detail. The sections that pile up over the years turn into compact tables, collapsible,
// below the cards. A whole card opens its record; a link or button inside it stays its own.

import type { ReactNode } from "react";
import { Fragment } from "react";
import { Link } from "react-router";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { DataTable } from "@/components/data-table";
import type { ColumnDefinition } from "@/components/lists/record-list";
import type { PerTier } from "@/hooks/use-tier";
import { useTier, valueForTier } from "@/hooks/use-tier";

export interface CardSection<Item> {
  id: string;
  // None for the cards at the head of the page.
  title?: string;
  items: readonly Item[];
  // Said where the section would be; without it an empty section is left out.
  emptyText?: string;
  isCollapsedByDefault?: boolean;
  presentation?: "cards" | { table: PerTier<readonly ColumnDefinition<Item>[]> };
}

export interface CardSectionsProps<Item> {
  sections: readonly CardSection<Item>[];
  itemId: (item: Item) => string;
  renderCard: (item: Item) => ReactNode;
  columns: PerTier<number>;
  // A line at the head that counts items, never pages: "2 proposed · 3 active".
  tile?: ReactNode;
  onOpen?: (id: string) => void;
}

export function CardSections<Item>({
  sections,
  itemId,
  renderCard,
  columns,
  tile,
  onOpen,
}: CardSectionsProps<Item>) {
  const columnCount = valueForTier(columns, useTier());

  return (
    <div className="grid gap-6">
      {tile !== undefined && <div className="text-sm text-muted-foreground">{tile}</div>}
      {sections.map((section) => {
        if (section.items.length === 0 && section.emptyText === undefined) {
          return null;
        }

        const body =
          section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{section.emptyText}</p>
          ) : section.presentation === undefined || section.presentation === "cards" ? (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
            >
              {section.items.map((item) => (
                <Fragment key={itemId(item)}>{renderCard(item)}</Fragment>
              ))}
            </div>
          ) : (
            <DataTable
              rows={section.items}
              rowId={itemId}
              columns={section.presentation.table}
              onOpen={onOpen}
              emptyText={section.emptyText ?? ""}
            />
          );

        if (section.title === undefined) {
          return <section key={section.id}>{body}</section>;
        }

        return (
          <details key={section.id} open={!section.isCollapsedByDefault} className="group">
            <summary className="mb-2.5 cursor-pointer text-sm font-semibold">
              {section.title}{" "}
              <span className="font-normal text-muted-foreground">· {section.items.length}</span>
            </summary>
            {body}
          </details>
        );
      })}
    </div>
  );
}

export interface RecordCardProps {
  title: string;
  href: string;
  badges?: ReactNode;
  // The line under the title: dates, target, who runs it.
  meta?: ReactNode;
  // A description, then bars.
  body?: ReactNode;
  note?: ReactNode;
  actions?: readonly ViewAction[];
  // Counts across the bottom, over a rule.
  foot?: ReactNode;
}

// The title's link stretches over the card, so the whole card opens the record; what is inside
// sits above it.
export function RecordCard({
  title,
  href,
  badges,
  meta,
  body,
  note,
  actions,
  foot,
}: RecordCardProps) {
  return (
    <article className="relative flex flex-col gap-3.5 rounded-lg border bg-card px-4.5 py-4 hover:border-ring">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-[1_1_16rem]">
          <Link
            to={href}
            className="font-semibold after:absolute after:inset-0 after:rounded-lg hover:underline"
          >
            {title}
          </Link>
          {meta !== undefined && <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>}
        </div>
        {badges !== undefined && <div className="flex shrink-0 flex-wrap gap-1.5">{badges}</div>}
      </div>
      {body}
      {note}
      {actions !== undefined && actions.length > 0 && (
        <div className="relative">
          <ActionBar actions={actions} />
        </div>
      )}
      {foot !== undefined && (
        <div className="mt-auto border-t pt-2.5 text-xs text-muted-foreground">{foot}</div>
      )}
    </article>
  );
}
