// The Intentions page (docs/demos/shared/page-intentions.js; STATUS "Intentions"; component-
// interfaces.md §1.4): what VERA is trying to digitize, as two columns of cards, Targets and
// Tracking, each running → upcoming with Ended and Archived folded below. The repeats head the
// Targets column. Where only one column fits, a Targets / Tracking switch picks it (`?col=track`);
// `?i=` opens one card, marks it and scrolls to it, `?t=` marks one repeat.
// TODO(rrandiak): *New intention*, *New repeat*, a repeat's *Edit* and a row's *Archive* /
// *Unarchive* arrive with the editor (plan.md 6.3); labels move to i18n.

import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import type { IntentionIndex, IntentionRow, IntentionTemplateRow } from "@/api/intentions";
import type { CardSection } from "@/components/card-sections";
import { CardSections } from "@/components/card-sections";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntentionCard } from "@/features/intentions/intention-card";
import type { IntentionColumn } from "@/features/intentions/intentions-view";
import {
  columnOf,
  columnSectionsOf,
  columnTitles,
  everyLabels,
  intentionColumns,
  intentionsUrlStateOf,
  periodNouns,
  shortWindowOf,
  tileOf,
  verdictBadgeOf,
} from "@/features/intentions/intentions-view";
import { useIntentionIndexQuery } from "@/features/intentions/use-intentions-query";
import { useUsersQuery } from "@/hooks/use-reference-query";
import { useTier } from "@/hooks/use-tier";
import { formatCalendarDay, formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { cn } from "@/lib/utils";

export function IntentionsPage() {
  const { data: index, error } = useIntentionIndexQuery();

  return (
    <>
      <PageHeader title="Intentions" />
      <PageContent>
        {error !== null ? (
          <StatusNote tone="red" title="Intentions could not be loaded">
            Try again in a moment.
          </StatusNote>
        ) : index === undefined ? null : (
          <IntentionBoard index={index} />
        )}
      </PageContent>
    </>
  );
}

function IntentionBoard({ index }: { index: IntentionIndex }) {
  const [params, setParams] = useSearchParams();
  const tier = useTier();
  const urlState = intentionsUrlStateOf(params, index.rows);
  const isOneColumn = tier === "phone" || tier === "small";
  const shown = isOneColumn ? [urlState.column] : intentionColumns;

  return (
    <div className="grid gap-6">
      {isOneColumn && (
        <Tabs
          value={urlState.column}
          onValueChange={(value) =>
            setParams(value === "track" ? { col: "track" } : {}, { replace: true })
          }
        >
          <TabsList>
            {intentionColumns.map((column) => (
              <TabsTrigger key={column} value={column}>
                {columnTitles[column]}
                <span className="ml-1 tabular-nums opacity-70">
                  {
                    index.rows.filter(
                      (row) =>
                        columnOf(row.intention) === column && row.intention.archived === null,
                    ).length
                  }
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className={cn("grid items-start gap-6", !isOneColumn && "grid-cols-2")}>
        {shown.map((column) => (
          <IntentionColumnView
            key={column}
            column={column}
            rows={index.rows}
            templates={column === "target" ? index.templates : []}
            focusedId={urlState.focusedId}
            focusedTemplateId={urlState.focusedTemplateId}
          />
        ))}
      </div>
      <p className="rounded-md border border-dashed bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        <b className="text-foreground">Nothing is attached to an intention.</b> An item counts
        towards every intention whose funding and category it matches, when its list starts inside
        the window — so one page can count towards a grant, a regional target and the house mix at
        once. Those figures overlap and are never added.
        <br />
        <b className="text-foreground">Planned and delivered are plan completion</b>: what was put
        on lists in the window, and how much of that was digitized in it.{" "}
        <b className="text-foreground">Output</b> is everything digitized in the window, whenever it
        was planned — what a mix is measured on.
        <br />
        <b className="text-foreground">The counting start is fixed once created.</b> To count from
        another date, make a new intention from the old one.
      </p>
    </div>
  );
}

interface IntentionColumnViewProps {
  column: IntentionColumn;
  rows: readonly IntentionRow[];
  templates: readonly IntentionTemplateRow[];
  focusedId: string | null;
  focusedTemplateId: string | null;
}

function IntentionColumnView({
  column,
  rows,
  templates,
  focusedId,
  focusedTemplateId,
}: IntentionColumnViewProps) {
  const { data: users = [] } = useUsersQuery();
  const sections = columnSectionsOf(rows, column);
  const isFocusedIn = (items: readonly IntentionRow[]) =>
    items.some((row) => row.intention.id === focusedId);
  const everyOf = (row: IntentionRow) =>
    templates.find((template) => template.template.id === row.intention.templateId)?.template
      .every ?? null;
  const archivedBy = (row: IntentionRow) => {
    const actor = row.intention.archived?.actor;
    if (actor?.kind === "system") {
      return "VERA (repeat)";
    }

    return actor?.kind === "user"
      ? (users.find((user) => user.id === actor.userId)?.name ?? actor.userId)
      : "";
  };
  const fold = (
    id: "ended" | "archived",
    title: string,
    items: IntentionRow[],
  ): CardSection<IntentionRow> => ({
    id,
    title,
    items,
    isCollapsedByDefault: !isFocusedIn(items),
    presentation: { table: { notebook: foldColumns(id, archivedBy) } },
  });
  const cardSections: CardSection<IntentionRow>[] = [
    { id: "running", items: sections.running, emptyText: "Nothing running." },
    { id: "upcoming", title: "Upcoming", items: sections.upcoming },
    fold("ended", "Ended", sections.ended),
    fold("archived", "Archived", sections.archived),
  ];

  return (
    <section className="grid min-w-0 gap-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2">
        <h2 className="text-base font-semibold">{columnTitles[column]}</h2>
        <Tile column={column} sections={sections} />
      </div>
      {templates.map((row) => (
        <RepeatLine
          key={row.template.id}
          row={row}
          isFocused={row.template.id === focusedTemplateId}
        />
      ))}
      <CardSections
        sections={cardSections}
        itemId={(row) => row.intention.id}
        renderCard={(row) => (
          <IntentionCard
            row={row}
            repeatEvery={everyOf(row)}
            isOpen={row.intention.id === focusedId}
          />
        )}
        columns={{ notebook: 1 }}
        focusedId={focusedId}
      />
    </section>
  );
}

function Tile({
  column,
  sections,
}: {
  column: IntentionColumn;
  sections: ReturnType<typeof columnSectionsOf>;
}) {
  return (
    <div className="text-[0.8125rem] text-muted-foreground">
      {tileOf(sections, column).map((part, index) => (
        <span key={part.key}>
          {index > 0 && " · "}
          {part.count !== null && (
            <b
              className={cn(
                "font-semibold text-foreground",
                part.isAlert && "text-tone-red-foreground",
              )}
            >
              {part.count}
            </b>
          )}{" "}
          {part.label}
        </span>
      ))}
    </div>
  );
}

// A repeat has its own address, `?t=`, which Schedules and the Tasks trigger link to.
function RepeatLine({ row, isFocused }: { row: IntentionTemplateRow; isFocused: boolean }) {
  const { template } = row;
  const [before, after = ""] = template.namePattern.split("{period}");
  const parts: ReactNode[] = [
    everyLabels[template.every].toLowerCase(),
    template.targetPages === null ? null : `${formatCount(template.targetPages)} pp`,
    row.tracks === null ? "own mix" : `tracks ${row.tracks.name}`,
    `next ${formatCalendarDay(template.nextOn)}`,
    template.isArchivingPrevious ? "archives the previous one" : null,
  ].filter((part) => part !== null);
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed px-3 py-2 text-[0.8125rem]",
        isFocused && "outline-2 outline-offset-2 outline-ring",
      )}
    >
      ↻{" "}
      <b className="font-semibold">
        {before}
        <i>{periodNouns[template.every]}</i>
        {after}
      </b>{" "}
      <span className="text-muted-foreground">· {parts.join(" · ")}</span>
    </div>
  );
}

function foldColumns(
  kind: "ended" | "archived",
  archivedBy: (row: IntentionRow) => string,
): ColumnDefinition<IntentionRow>[] {
  return [
    {
      key: "intention",
      header: "Intention",
      track: "minmax(10rem,1fr)",
      cell: (row) => (
        <>
          <span className="font-medium">{row.intention.name}</span>
          {row.intention.templateId !== null && <span className="text-muted-foreground"> ↻</span>}
          <div className="text-xs text-muted-foreground">{shortWindowOf(row.intention)}</div>
        </>
      ),
    },
    {
      key: "result",
      header: "Result",
      track: "max-content",
      isNumeric: true,
      cell: (row) =>
        row.intention.targetPages === null
          ? `${formatCount(row.outputPages)} pp output`
          : `${formatCount(row.deliveredPages)} / ${formatCount(row.intention.targetPages)} pp`,
    },
    {
      key: "status",
      header: kind === "archived" ? "Archived" : "",
      track: "max-content",
      cell: (row) => {
        const verdict = verdictBadgeOf(row);
        return (
          <>
            {verdict !== null && (
              <ToneBadge tone={verdict.tone}>{verdict.text.replace("Ended — ", "")}</ToneBadge>
            )}
            {kind === "archived" && row.intention.archived !== null && (
              <div className="text-xs text-muted-foreground">
                {formatDay(row.intention.archived.at)} · {archivedBy(row)}
              </div>
            )}
          </>
        );
      },
    },
  ];
}
